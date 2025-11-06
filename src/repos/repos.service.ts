import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  DeleteCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { UsersService } from '../users/users.service';
import type { GitHubRepo, DynamoDBRepo } from './types/repos.types';
import type {
  RepoDashboard,
  RepoInfo,
  RecentActivity,
  RecentActivityItem,
  DailyStats,
  WeeklyComparison,
  Contributor,
  GraphQLResponse,
} from './types/repo-dashboard.types';

@Injectable()
export class ReposService {
  private dynamoDBClient: DynamoDBDocumentClient;
  private reposTableName: string;

  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    const client = new DynamoDBClient({
      region: this.configService.get<string>('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || '',
        secretAccessKey:
          this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '',
      },
    });

    this.dynamoDBClient = DynamoDBDocumentClient.from(client);
    this.reposTableName =
      this.configService.get<string>('DYNAMO_REPOS_TABLE') || 'Repos';
  }

  private async getAllGitHubRepos(userId: number): Promise<GitHubRepo[]> {
    try {
      const user = await this.usersService.findByGitHubId(userId);
      if (!user || !user.githubAccessToken) {
        throw new NotFoundException(
          'Token GitHub non trouvé pour cet utilisateur',
        );
      }

      const response = await fetch('https://api.github.com/user/repos', {
        headers: {
          Authorization: `Bearer ${user.githubAccessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new InternalServerErrorException(
          `Erreur lors de la récupération des repos GitHub: ${response.statusText}`,
        );
      }

      const allRepos = (await response.json()) as GitHubRepo[];
      return allRepos;
    } catch (error) {
      console.error('Erreur dans getAllGitHubRepos:', error);
      throw new InternalServerErrorException(
        'Erreur lors de la récupération des repos GitHub',
      );
    }
  }

  async getAvailableGitHubRepos(userId: number): Promise<GitHubRepo[]> {
    try {
      // 1. Récupérer tous les repos GitHub
      const allRepos = await this.getAllGitHubRepos(userId);

      const selectedReposResult = await this.dynamoDBClient.send(
        new QueryCommand({
          TableName: this.reposTableName,
          KeyConditionExpression: 'user_id = :user_id',
          ExpressionAttributeValues: {
            ':user_id': userId,
          },
        }),
      );

      const selectedRepos = (selectedReposResult.Items || []).map(
        (item: DynamoDBRepo) => {
          const { user_id, repo_id, ...rest } = item;
          return {
            ...rest,
            id: repo_id,
          } as GitHubRepo;
        },
      );
      const selectedRepoIds = selectedRepos.map((repo) => repo.id);

      const availableRepos = allRepos.filter(
        (repo) => !selectedRepoIds.includes(repo.id),
      );

      return availableRepos;
    } catch (error) {
      console.error('Erreur dans getAvailableGitHubRepos:', error);
      throw new InternalServerErrorException(
        'Erreur lors de la récupération des repos GitHub',
      );
    }
  }

  async getSelectedRepos(userId: number): Promise<GitHubRepo[]> {
    try {
      const result = await this.dynamoDBClient.send(
        new QueryCommand({
          TableName: this.reposTableName,
          KeyConditionExpression: 'user_id = :user_id',
          ExpressionAttributeValues: {
            ':user_id': userId,
          },
        }),
      );

      return (result.Items || []).map((item: DynamoDBRepo) => {
        const { user_id, repo_id, ...rest } = item;
        return {
          ...rest,
          id: repo_id,
        } as GitHubRepo;
      });
    } catch (error) {
      console.error(
        'Erreur lors de la récupération des repos sélectionnés:',
        error,
      );
      throw new InternalServerErrorException(
        'Erreur lors de la récupération des repos sélectionnés',
      );
    }
  }

  private hasRepoChanged(
    storedRepo: GitHubRepo,
    githubRepo: GitHubRepo,
  ): boolean {
    return (
      storedRepo.name !== githubRepo.name ||
      storedRepo.full_name !== githubRepo.full_name ||
      (storedRepo.description || '') !== (githubRepo.description || '') ||
      storedRepo.stargazers_count !== githubRepo.stargazers_count ||
      storedRepo.forks_count !== githubRepo.forks_count ||
      storedRepo.language !== (githubRepo.language || null) ||
      storedRepo.pushed_at !== githubRepo.pushed_at ||
      storedRepo.default_branch !== githubRepo.default_branch ||
      storedRepo.private !== githubRepo.private ||
      storedRepo.html_url !== githubRepo.html_url
    );
  }

  async syncRepos(userId: number): Promise<string[]> {
    try {
      const githubRepos = await this.getAllGitHubRepos(userId);
      const githubRepoIds = new Set(githubRepos.map((repo) => repo.id));
      const githubReposMap = new Map(
        githubRepos.map((repo) => [repo.id, repo]),
      );

      const result = await this.dynamoDBClient.send(
        new QueryCommand({
          TableName: this.reposTableName,
          KeyConditionExpression: 'user_id = :user_id',
          ExpressionAttributeValues: {
            ':user_id': userId,
          },
        }),
      );

      const storedRepos = (result.Items || []).map((item: DynamoDBRepo) => {
        const { user_id, repo_id, ...rest } = item;
        return {
          ...rest,
          id: repo_id,
        } as GitHubRepo;
      });

      const reposDeletedFromGithub: string[] = [];
      const reposToDelete: DynamoDBRepo[] = [];

      for (const storedRepo of storedRepos) {
        if (!githubRepoIds.has(storedRepo.id)) {
          reposDeletedFromGithub.push(storedRepo.name);
          reposToDelete.push({
            repo_id: storedRepo.id,
            user_id: userId,
          } as DynamoDBRepo);
        }
      }

      if (reposToDelete.length > 0) {
        const batchSize = 25;
        for (let i = 0; i < reposToDelete.length; i += batchSize) {
          const batch = reposToDelete.slice(i, i + batchSize);
          await this.dynamoDBClient.send(
            new BatchWriteCommand({
              RequestItems: {
                [this.reposTableName]: batch.map((item) => ({
                  DeleteRequest: {
                    Key: {
                      repo_id: item.repo_id,
                      user_id: item.user_id,
                    },
                  },
                })),
              },
            }),
          );
        }
      }

      for (const storedRepo of storedRepos) {
        const githubRepo = githubReposMap.get(storedRepo.id);
        if (githubRepo && this.hasRepoChanged(storedRepo, githubRepo)) {
          const repoItem: DynamoDBRepo = {
            repo_id: githubRepo.id,
            user_id: userId,
            name: githubRepo.name,
            full_name: githubRepo.full_name,
            description: githubRepo.description || '',
            html_url: githubRepo.html_url,
            private: githubRepo.private,
            language: githubRepo.language || null,
            stargazers_count: githubRepo.stargazers_count || 0,
            forks_count: githubRepo.forks_count || 0,
            default_branch: githubRepo.default_branch || 'main',
            pushed_at: githubRepo.pushed_at || new Date().toISOString(),

            selected_at: storedRepo.selected_at || new Date().toISOString(),
            created_at: storedRepo.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          await this.dynamoDBClient.send(
            new PutCommand({
              TableName: this.reposTableName,
              Item: repoItem,
            }),
          );
        }
      }

      return reposDeletedFromGithub;
    } catch (error) {
      console.error('Erreur lors de la synchronisation des repos:', error);
      throw new InternalServerErrorException(
        'Erreur lors de la synchronisation des repos',
      );
    }
  }

  async saveSelectedRepos(
    userId: number,
    repoIds: number[],
  ): Promise<GitHubRepo[]> {
    try {
      if (!repoIds || repoIds.length === 0) {
        throw new BadRequestException('Aucun ID de repo fourni');
      }

      const allRepos = await this.getAllGitHubRepos(userId);

      const reposToSave = allRepos.filter((repo) => repoIds.includes(repo.id));

      if (reposToSave.length === 0) {
        throw new NotFoundException(
          'Aucun repo trouvé correspondant aux IDs fournis',
        );
      }

      const savedRepos: DynamoDBRepo[] = [];
      for (const repo of reposToSave) {
        if (!repo.id) {
          throw new InternalServerErrorException(
            'ID du repo manquant lors de la sauvegarde',
          );
        }

        const repoItem: DynamoDBRepo = {
          repo_id: repo.id,
          user_id: userId,
          name: repo.name,
          full_name: repo.full_name,
          description: repo.description || '',
          html_url: repo.html_url,
          private: repo.private,
          language: repo.language || null,
          stargazers_count: repo.stargazers_count || 0,
          forks_count: repo.forks_count || 0,
          default_branch: repo.default_branch || 'main',
          pushed_at: repo.pushed_at || new Date().toISOString(),

          selected_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await this.dynamoDBClient.send(
          new PutCommand({
            TableName: this.reposTableName,
            Item: repoItem,
          }),
        );

        savedRepos.push(repoItem);
      }

      return savedRepos.map((item: DynamoDBRepo) => {
        const { user_id, repo_id, ...rest } = item;
        return {
          ...rest,
          id: repo_id,
        } as GitHubRepo;
      });
    } catch (error) {
      console.error("Erreur lors de l'enregistrement des repos:", error);

      throw new InternalServerErrorException(
        "Erreur lors de l'enregistrement des repos",
      );
    }
  }

  async deleteRepo(userId: number, repoId: number): Promise<void> {
    try {
      await this.dynamoDBClient.send(
        new DeleteCommand({
          TableName: this.reposTableName,
          Key: {
            repo_id: repoId,
            user_id: userId,
          },
        }),
      );
    } catch (error) {
      console.error('Erreur lors de la suppression du repo:', error);
      throw new InternalServerErrorException(
        'Erreur lors de la suppression du repo',
      );
    }
  }

  async deleteAllReposByUserId(userId: number): Promise<void> {
    try {
      const result = await this.dynamoDBClient.send(
        new QueryCommand({
          TableName: this.reposTableName,
          KeyConditionExpression: 'user_id = :user_id',
          ExpressionAttributeValues: {
            ':user_id': userId,
          },
        }),
      );

      if (!result.Items || result.Items.length === 0) {
        return;
      }

      // BatchWriteCommand peut gérer jusqu'à 25 items à la fois
      const items = result.Items as DynamoDBRepo[];
      const batchSize = 25;

      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);

        await this.dynamoDBClient.send(
          new BatchWriteCommand({
            RequestItems: {
              [this.reposTableName]: batch.map((item) => ({
                DeleteRequest: {
                  Key: {
                    repo_id: item.repo_id,
                    user_id: item.user_id,
                  },
                },
              })),
            },
          }),
        );
      }
    } catch (error) {
      console.error(
        "Erreur lors de la suppression de tous les repos de l'utilisateur:",
        error,
      );
      throw new InternalServerErrorException(
        "Erreur lors de la suppression de tous les repos de l'utilisateur",
      );
    }
  }

  // ==================== MÉTHODES GRAPHQL GITHUB ====================

  /**
   * Récupère le token GitHub de l'utilisateur
   */
  private async getGitHubToken(userId: number): Promise<string> {
    const user = await this.usersService.findByGitHubId(userId);
    if (!user || !user.githubAccessToken) {
      throw new NotFoundException(
        'Token GitHub non trouvé pour cet utilisateur',
      );
    }
    return user.githubAccessToken;
  }

  /**
   * Récupère les données complètes d'un repo via GraphQL GitHub
   */
  private async fetchRepoDataWithGraphQL(
    userId: number,
    owner: string,
    name: string,
  ): Promise<GraphQLResponse['data']['repository']> {
    try {
      const token = await this.getGitHubToken(userId);

      const query = `
        query GetRepoDashboard($owner: String!, $name: String!) {
          repository(owner: $owner, name: $name) {
            name
            description
            isFork
            stargazerCount
            diskUsage
            languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
              totalSize
              edges {
                size
                node {
                  name
                }
              }
            }
            defaultBranchRef {
              target {
                ... on Commit {
                  history(first: 100) {
                    nodes {
                      oid
                      messageHeadline
                      committedDate
                      author {
                        name
                        avatarUrl
                      }
                    }
                  }
                }
              }
            }
            issues(first: 100, orderBy: {field: CREATED_AT, direction: DESC}) {
              nodes {
                number
                title
                createdAt
                url
                author {
                  login
                  avatarUrl
                }
              }
            }
            pullRequests(first: 100, orderBy: {field: CREATED_AT, direction: DESC}) {
              nodes {
                number
                title
                createdAt
                url
                author {
                  login
                  avatarUrl
                }
              }
            }
          }
        }
      `;

      const response = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: {
            owner,
            name,
          },
        }),
      });

      if (!response.ok) {
        throw new InternalServerErrorException(
          `Erreur GitHub API: ${response.statusText}`,
        );
      }

      const result: GraphQLResponse = await response.json();

      if (result.errors) {
        console.error('Erreurs GraphQL:', result.errors);
        throw new InternalServerErrorException(
          `Erreur GraphQL: ${result.errors[0].message}`,
        );
      }

      if (!result.data.repository) {
        throw new NotFoundException('Repository not found');
      }

      // Debug: log des données récupérées
      const repo = result.data.repository;
      console.log('GraphQL Data:', {
        hasDefaultBranchRef: !!repo.defaultBranchRef,
        commitsCount:
          repo.defaultBranchRef?.target?.history?.nodes?.length || 0,
        issuesCount: repo.issues?.nodes?.length || 0,
        prsCount: repo.pullRequests?.nodes?.length || 0,
      });

      return repo;
    } catch (error) {
      console.error(
        'Erreur lors de la récupération des données GraphQL:',
        error,
      );
      throw new InternalServerErrorException(
        'Erreur lors de la récupération des données du repository',
      );
    }
  }

  /**
   * Extrait les infos du repo (Partie 1)
   */
  private extractRepoInfo(
    repo: GraphQLResponse['data']['repository'],
    contributorsCount: number,
    repoUrl: string,
    repoId: number,
  ): RepoInfo {
    // Le dernier commit est le premier de l'historique (trié par date décroissante)
    const commits = repo.defaultBranchRef?.target?.history?.nodes || [];
    const lastCommitNode = commits.length > 0 ? commits[0] : null;

    // Calculer les pourcentages des langages
    const languageEdges = repo.languages?.edges || [];
    const totalSize = repo.languages?.totalSize || 0;
    const languagesWithPercentage = languageEdges.map((edge) => ({
      name: edge.node.name,
      percentage:
        totalSize > 0
          ? Math.round((edge.size / totalSize) * 100 * 100) / 100
          : 0,
    }));

    return {
      id: repoId,
      name: repo.name,
      description: repo.description,
      url: repoUrl,
      languages: languagesWithPercentage,
      isFork: repo.isFork,
      sizeMb: Math.round((repo.diskUsage / 1024 / 1024) * 100) / 100,
      contributorsCount,
      starsCount: repo.stargazerCount,
      lastCommit: lastCommitNode
        ? {
            sha: lastCommitNode.oid,
            message: lastCommitNode.messageHeadline,
            author: lastCommitNode.author?.name || 'Unknown',
            authorAvatar: lastCommitNode.author?.avatarUrl || '',
            date: lastCommitNode.committedDate,
          }
        : {
            sha: '',
            message: 'No commits',
            author: '',
            authorAvatar: '',
            date: '',
          },
    };
  }

  /**
   * Extrait les activités récentes (Partie 2) - 48 dernières heures (2 derniers jours)
   * Inclut les commits, PRs et issues avec leurs stats
   */
  private extractRecentActivity(
    repo: GraphQLResponse['data']['repository'],
    owner: string,
    name: string,
  ): RecentActivity {
    const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const items: RecentActivityItem[] = [];

    // 1. Commits des 48 dernières heures
    const allCommits = repo.defaultBranchRef?.target?.history?.nodes || [];
    const recentCommits = allCommits.filter((commit) => {
      if (!commit.committedDate) return false;
      const commitDate = new Date(commit.committedDate);
      return commitDate >= since48h;
    });

    recentCommits.forEach((commit) => {
      items.push({
        type: 'commit',
        title: commit.messageHeadline,
        author: commit.author?.name || 'Unknown',
        authorAvatar: commit.author?.avatarUrl || '',
        date: commit.committedDate,
        url: `https://github.com/${owner}/${name}/commit/${commit.oid}`,
        sha: commit.oid,
      });
    });

    // 2. Issues des 48 dernières heures
    const allIssues = repo.issues?.nodes || [];
    const recentIssues = allIssues.filter((issue) => {
      if (!issue.createdAt) return false;
      const issueDate = new Date(issue.createdAt);
      return issueDate >= since48h;
    });

    recentIssues.forEach((issue) => {
      items.push({
        type: 'issue',
        title: issue.title,
        author: issue.author?.login || 'Unknown',
        authorAvatar: issue.author?.avatarUrl || '',
        date: issue.createdAt,
        url: issue.url,
        number: issue.number,
      });
    });

    // 3. Pull Requests des 48 dernières heures
    const allPRs = repo.pullRequests?.nodes || [];
    const recentPRs = allPRs.filter((pr) => {
      if (!pr.createdAt) return false;
      const prDate = new Date(pr.createdAt);
      return prDate >= since48h;
    });

    recentPRs.forEach((pr) => {
      items.push({
        type: 'pr',
        title: pr.title,
        author: pr.author?.login || 'Unknown',
        authorAvatar: pr.author?.avatarUrl || '',
        date: pr.createdAt,
        url: pr.url,
        number: pr.number,
      });
    });

    // Trier par date (plus récent en premier)
    const sortedItems = items.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    // Calculer les stats
    const stats = {
      commits: recentCommits.length,
      prs: recentPRs.length,
      issues: recentIssues.length,
    };

    return {
      stats,
      items: sortedItems,
    };
  }

  /**
   * Calcule les stats journalières (Partie 3)
   */
  private calculateDailyStats(
    commits30d: Array<{ committedDate: string }>,
    issues30d: Array<{ createdAt: string }>,
    prs30d: Array<{ createdAt: string }>,
  ): DailyStats[] {
    // Initialiser un objet pour chaque jour des 30 derniers jours
    const dailyStatsMap: Record<string, DailyStats> = {};

    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];
      dailyStatsMap[dateStr] = {
        date: dateStr,
        commits: 0,
        prs: 0,
        issues: 0,
      };
    }

    // Grouper les commits par jour
    commits30d.forEach((commit) => {
      const date = commit.committedDate.split('T')[0];
      if (dailyStatsMap[date]) {
        dailyStatsMap[date].commits++;
      }
    });

    // Grouper les issues par jour
    issues30d.forEach((issue) => {
      const date = issue.createdAt.split('T')[0];
      if (dailyStatsMap[date]) {
        dailyStatsMap[date].issues++;
      }
    });

    // Grouper les PRs par jour
    prs30d.forEach((pr) => {
      const date = pr.createdAt.split('T')[0];
      if (dailyStatsMap[date]) {
        dailyStatsMap[date].prs++;
      }
    });

    // Convertir en tableau trié par date (plus récent en premier)
    return Object.values(dailyStatsMap).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }

  /**
   * Calcule la comparaison hebdomadaire (Partie 4)
   */
  private calculateWeeklyComparison(
    commits30d: Array<{ committedDate: string }>,
    issues30d: Array<{ createdAt: string }>,
    prs30d: Array<{ createdAt: string }>,
  ): WeeklyComparison {
    const now = new Date();
    now.setHours(23, 59, 59, 999);

    // Semaine actuelle (7 derniers jours)
    const week1Start = new Date(now);
    week1Start.setDate(now.getDate() - 7);
    week1Start.setHours(0, 0, 0, 0);
    const week1End = now;

    // Semaine précédente (jours 8-14)
    const week2Start = new Date(now);
    week2Start.setDate(now.getDate() - 14);
    week2Start.setHours(0, 0, 0, 0);
    const week2End = new Date(now);
    week2End.setDate(now.getDate() - 7);
    week2End.setHours(23, 59, 59, 999);

    // Compter les commits par semaine
    let week1Commits = 0;
    let week2Commits = 0;

    commits30d.forEach((commit) => {
      const commitDate = new Date(commit.committedDate);
      if (commitDate >= week1Start && commitDate <= week1End) {
        week1Commits++;
      } else if (commitDate >= week2Start && commitDate <= week2End) {
        week2Commits++;
      }
    });

    // Compter les issues par semaine
    let week1Issues = 0;
    let week2Issues = 0;

    issues30d.forEach((issue) => {
      const issueDate = new Date(issue.createdAt);
      if (issueDate >= week1Start && issueDate <= week1End) {
        week1Issues++;
      } else if (issueDate >= week2Start && issueDate <= week2End) {
        week2Issues++;
      }
    });

    // Compter les PRs par semaine
    let week1PRs = 0;
    let week2PRs = 0;

    prs30d.forEach((pr) => {
      const prDate = new Date(pr.createdAt);
      if (prDate >= week1Start && prDate <= week1End) {
        week1PRs++;
      } else if (prDate >= week2Start && prDate <= week2End) {
        week2PRs++;
      }
    });

    // Calculer le pourcentage d'évolution
    const calculatePercentage = (current: number, previous: number): number => {
      if (previous === 0) {
        return current > 0 ? 100 : 0;
      }
      return Math.round(((current - previous) / previous) * 100 * 100) / 100;
    };

    return {
      commits: {
        currentWeek: week1Commits,
        lastWeek: week2Commits,
        percentage: calculatePercentage(week1Commits, week2Commits),
      },
      prs: {
        currentWeek: week1PRs,
        lastWeek: week2PRs,
        percentage: calculatePercentage(week1PRs, week2PRs),
      },
      issues: {
        currentWeek: week1Issues,
        lastWeek: week2Issues,
        percentage: calculatePercentage(week1Issues, week2Issues),
      },
    };
  }

  /**
   * Récupère les contributeurs via l'API REST GitHub
   */
  private async fetchContributors(
    userId: number,
    owner: string,
    name: string,
  ): Promise<Contributor[]> {
    try {
      const token = await this.getGitHubToken(userId);
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${name}/contributors?per_page=100`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        },
      );

      if (!response.ok) {
        // Si l'API REST échoue, retourner un tableau vide plutôt que de faire planter
        console.warn(
          `Erreur lors de la récupération des contributeurs: ${response.statusText}`,
        );
        return [];
      }

      const contributors = await response.json();

      return contributors
        .map((contrib: any) => ({
          username: contrib.login,
          commits: contrib.contributions,
          avatar: contrib.avatar_url,
          url: contrib.html_url || `https://github.com/${contrib.login}`,
        }))
        .sort((a: Contributor, b: Contributor) => b.commits - a.commits);
    } catch (error) {
      console.error('Erreur lors de la récupération des contributeurs:', error);
      return [];
    }
  }

  /**
   * Récupère toutes les données du dashboard d'un repo
   */
  async getRepoDetails(userId: number, repoId: number): Promise<RepoDashboard> {
    try {
      // 1. Récupérer le repo depuis DynamoDB pour avoir owner/name
      const selectedRepos = await this.getSelectedRepos(userId);
      const repo = selectedRepos.find((r) => r.id === repoId);

      if (!repo) {
        throw new NotFoundException('Repository not found');
      }

      const [owner, name] = repo.full_name.split('/');

      // 2. Récupérer toutes les données via GraphQL
      const graphQLData = await this.fetchRepoDataWithGraphQL(
        userId,
        owner,
        name,
      );

      // 3. Récupérer les contributeurs via l'API REST (car GraphQL ne supporte pas ce champ)
      const contributors = await this.fetchContributors(userId, owner, name);

      // 4. Extraire les commits 30 jours depuis l'historique
      const allCommits =
        graphQLData.defaultBranchRef?.target?.history?.nodes || [];
      console.log('All commits from GraphQL:', allCommits.length);

      const commits30d = allCommits
        .filter((commit) => commit.committedDate)
        .map((commit) => ({ committedDate: commit.committedDate }));
      console.log('Commits 30d after filter:', commits30d.length);

      // 5. Filtrer les issues et PRs des 30 derniers jours côté backend
      const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      console.log('Since 30d date:', since30d.toISOString());

      const allIssues = graphQLData.issues?.nodes || [];
      console.log('All issues from GraphQL:', allIssues.length);
      const issues30d = allIssues.filter((issue) => {
        if (!issue.createdAt) return false;
        const issueDate = new Date(issue.createdAt);
        return issueDate >= since30d;
      });
      console.log('Issues 30d after filter:', issues30d.length);

      const allPRs = graphQLData.pullRequests?.nodes || [];
      console.log('All PRs from GraphQL:', allPRs.length);
      const prs30d = allPRs.filter((pr) => {
        if (!pr.createdAt) return false;
        const prDate = new Date(pr.createdAt);
        return prDate >= since30d;
      });
      console.log('PRs 30d after filter:', prs30d.length);

      // 6. Transformer chaque partie
      return {
        // Partie 1 : Infos du repo
        info: this.extractRepoInfo(
          graphQLData,
          contributors.length,
          repo.html_url,
          repoId,
        ),

        // Partie 2 : Activités des 48 dernières heures (2 derniers jours) - commits, PRs, issues
        recentActivity: this.extractRecentActivity(graphQLData, owner, name),

        // Partie 3 : Stats journalières 30 jours
        dailyStats: this.calculateDailyStats(commits30d, issues30d, prs30d),

        // Partie 4 : Comparaison hebdomadaire
        weeklyComparison: this.calculateWeeklyComparison(
          commits30d,
          issues30d,
          prs30d,
        ),

        // Partie 5 : Contributeurs
        contributors,
      };
    } catch (error) {
      console.error('Erreur lors de la récupération du dashboard:', error);
      throw error;
    }
  }
}
