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
  GetCommand,
  PutCommand,
  DeleteCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { UsersService } from '../users/users.service';
import type {
  GitHubRepo,
  DynamoDBRepo,
  GitHubApiRepo,
  GitHubApiContributor,
  GitHubApiCommit,
  GitHubApiRepoInfo,
  GitHubApiLanguage,
  GitHubApiIssue,
  GitHubApiPullRequest,
} from './types/repos.types';
import type {
  RepoDashboard,
  RepoInfo,
  RecentActivity,
  RecentActivityItem,
  DailyStats,
  WeeklyComparison,
  Contributor,
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

  private mapGitHubApiToRepo(item: GitHubApiRepo): GitHubRepo {
    return {
      id: item.id,
      name: item.name,
      fullName: item.full_name,
      description: item.description,
      htmlUrl: item.html_url,
      private: item.private,
      language: item.language,
      pushedAt: item.pushed_at,
    };
  }

  private async getAllGitHubRepos(userId: number): Promise<GitHubRepo[]> {
    try {
      const user = await this.usersService.findUserByGithubId(userId);
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

      const allRepos = (await response.json()) as GitHubApiRepo[];
      return allRepos.map((repo) => this.mapGitHubApiToRepo(repo));
    } catch (error) {
      throw new InternalServerErrorException(
        'Erreur lors de la récupération des repos GitHub',
      );
    }
  }

  async getAvailableGitHubRepos(userId: number): Promise<GitHubRepo[]> {
    try {
      const allRepos = await this.getAllGitHubRepos(userId);

      const selectedReposResult = await this.dynamoDBClient.send(
        new QueryCommand({
          TableName: this.reposTableName,
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: {
            ':userId': userId,
          },
        }),
      );

      const selectedRepos = (selectedReposResult.Items || []).map(
        (item: DynamoDBRepo): GitHubRepo => {
          const { repoId, userId, ...rest } = item;
          return {
            id: repoId,
            ...rest,
          };
        },
      );
      const selectedRepoIds = selectedRepos.map((repo) => repo.id);

      const availableRepos = allRepos.filter(
        (repo) => !selectedRepoIds.includes(repo.id),
      );

      return availableRepos;
    } catch (error) {
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
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: {
            ':userId': userId,
          },
        }),
      );

      return (result.Items || []).map((item: DynamoDBRepo): GitHubRepo => {
        const { repoId, userId, ...rest } = item;
        return {
          id: repoId,
          ...rest,
        };
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'Erreur lors de la récupération des repos sélectionnés',
      );
    }
  }

  async getSelectedRepo(userId: number, repoId: number): Promise<GitHubRepo> {
    try {
      const result = await this.dynamoDBClient.send(
        new GetCommand({
          TableName: this.reposTableName,
          Key: {
            repoId: repoId,
            userId: userId,
          },
        }),
      );

      if (!result.Item) {
        throw new NotFoundException('Dépôt introuvable');
      }

      const item = result.Item as DynamoDBRepo;
      const { repoId: id, userId: _userId, ...rest } = item;
      return {
        id,
        ...rest,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Erreur lors de la récupération du repo',
      );
    }
  }

  private hasRepoChanged(
    storedRepo: GitHubRepo,
    githubRepo: GitHubRepo,
  ): boolean {
    return (
      storedRepo.name !== githubRepo.name ||
      storedRepo.fullName !== githubRepo.fullName ||
      (storedRepo.description || '') !== (githubRepo.description || '') ||
      storedRepo.language !== (githubRepo.language || null) ||
      storedRepo.pushedAt !== githubRepo.pushedAt ||
      storedRepo.private !== githubRepo.private ||
      storedRepo.htmlUrl !== githubRepo.htmlUrl
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
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: {
            ':userId': userId,
          },
        }),
      );

      const storedRepos = (result.Items || []).map(
        (item: DynamoDBRepo): GitHubRepo => {
          const { repoId, userId, ...rest } = item;
          return {
            id: repoId,
            ...rest,
          };
        },
      );

      const reposDeletedFromGithub: string[] = [];
      const reposToDelete: DynamoDBRepo[] = [];

      for (const storedRepo of storedRepos) {
        if (!githubRepoIds.has(storedRepo.id)) {
          reposDeletedFromGithub.push(storedRepo.name);
          reposToDelete.push({
            repoId: storedRepo.id,
            userId: userId,
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
                      repoId: item.repoId,
                      userId: item.userId,
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
            repoId: githubRepo.id,
            userId: userId,
            name: githubRepo.name,
            fullName: githubRepo.fullName,
            description: githubRepo.description || '',
            htmlUrl: githubRepo.htmlUrl,
            private: githubRepo.private,
            language: githubRepo.language || null,
            pushedAt: githubRepo.pushedAt || new Date().toISOString(),
            selectedAt: storedRepo.selectedAt || new Date().toISOString(),
            createdAt: storedRepo.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
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
          repoId: repo.id,
          userId: userId,
          name: repo.name,
          fullName: repo.fullName,
          description: repo.description || '',
          htmlUrl: repo.htmlUrl,
          private: repo.private,
          language: repo.language || null,
          pushedAt: repo.pushedAt || new Date().toISOString(),
          selectedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await this.dynamoDBClient.send(
          new PutCommand({
            TableName: this.reposTableName,
            Item: repoItem,
          }),
        );

        savedRepos.push(repoItem);
      }

      return savedRepos.map((item: DynamoDBRepo): GitHubRepo => {
        const { repoId, userId, ...rest } = item;
        return {
          id: repoId,
          ...rest,
        };
      });
    } catch (error) {
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
            repoId: repoId,
            userId: userId,
          },
        }),
      );
    } catch (error) {
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
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: {
            ':userId': userId,
          },
        }),
      );

      if (!result.Items || result.Items.length === 0) {
        return;
      }

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
                    repoId: item.repoId,
                    userId: item.userId,
                  },
                },
              })),
            },
          }),
        );
      }
    } catch (error) {
      throw new InternalServerErrorException(
        "Erreur lors de la suppression de tous les repos de l'utilisateur",
      );
    }
  }

  private async getGitHubToken(userId: number): Promise<string> {
    const user = await this.usersService.findUserByGithubId(userId);
    if (!user || !user.githubAccessToken) {
      throw new NotFoundException(
        'Token GitHub non trouvé pour cet utilisateur',
      );
    }
    return user.githubAccessToken;
  }

  private async fetchRepoInfo(
    userId: number,
    owner: string,
    name: string,
  ): Promise<GitHubApiRepoInfo> {
    try {
      const token = await this.getGitHubToken(userId);
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${name}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        },
      );

      if (!response.ok) {
        throw new InternalServerErrorException(
          `Erreur lors de la récupération des infos du repo: ${response.statusText}`,
        );
      }

      return (await response.json()) as GitHubApiRepoInfo;
    } catch (error) {
      throw new InternalServerErrorException(
        'Erreur lors de la récupération des infos du repository',
      );
    }
  }

  private async fetchRepoLanguages(
    userId: number,
    owner: string,
    name: string,
  ): Promise<GitHubApiLanguage> {
    try {
      const token = await this.getGitHubToken(userId);
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${name}/languages`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        },
      );

      if (!response.ok) {
        return {};
      }

      return (await response.json()) as GitHubApiLanguage;
    } catch (error) {
      return {};
    }
  }

  private async fetchIssuesLast30Days(
    userId: number,
    owner: string,
    name: string,
  ): Promise<GitHubApiIssue[]> {
    try {
      const token = await this.getGitHubToken(userId);
      const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const sinceISO = since30d.toISOString();

      const allIssues: GitHubApiIssue[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await fetch(
          `https://api.github.com/repos/${owner}/${name}/issues?since=${sinceISO}&per_page=100&page=${page}&state=all`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.github.v3+json',
            },
          },
        );

        if (!response.ok) {
          break;
        }

        const issues = (await response.json()) as GitHubApiIssue[];

        const onlyIssues = issues.filter((issue) => !('pull_request' in issue));

        if (onlyIssues.length === 0) {
          hasMore = false;
        } else {
          allIssues.push(...onlyIssues);
          page++;

          const linkHeader = response.headers.get('Link');
          if (!linkHeader || !linkHeader.includes('rel="next"')) {
            hasMore = false;
          }
        }
      }

      return allIssues;
    } catch (error) {
      return [];
    }
  }

  private async fetchPullRequestsLast30Days(
    userId: number,
    owner: string,
    name: string,
  ): Promise<GitHubApiPullRequest[]> {
    try {
      const token = await this.getGitHubToken(userId);
      const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const sinceISO = since30d.toISOString();

      const allPRs: GitHubApiPullRequest[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await fetch(
          `https://api.github.com/repos/${owner}/${name}/pulls?since=${sinceISO}&per_page=100&page=${page}&state=all`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.github.v3+json',
            },
          },
        );

        if (!response.ok) {
          break;
        }

        const prs = (await response.json()) as GitHubApiPullRequest[];

        if (prs.length === 0) {
          hasMore = false;
        } else {
          allPRs.push(...prs);
          page++;

          const linkHeader = response.headers.get('Link');
          if (!linkHeader || !linkHeader.includes('rel="next"')) {
            hasMore = false;
          }
        }
      }

      return allPRs;
    } catch (error) {
      return [];
    }
  }

  private extractRepoInfo(
    repoInfo: GitHubApiRepoInfo,
    languages: GitHubApiLanguage,
    allCommitsREST: GitHubApiCommit[],
    contributorsCount: number,
    repoUrl: string,
    repoId: number,
  ): RepoInfo {
    const lastCommitNode = allCommitsREST.length > 0 ? allCommitsREST[0] : null;

    const totalSize = Object.values(languages).reduce(
      (sum, size) => sum + size,
      0,
    );
    const languagesWithPercentage = Object.entries(languages)
      .map(([name, size]) => ({
        name,
        percentage:
          totalSize > 0 ? Math.round((size / totalSize) * 100 * 100) / 100 : 0,
      }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 10);

    return {
      id: repoId,
      name: repoInfo.name,
      description: repoInfo.description,
      url: repoUrl,
      languages: languagesWithPercentage,
      isFork: repoInfo.fork,
      sizeMb: Math.round((repoInfo.size / 1024) * 100) / 100,
      contributorsCount,
      starsCount: repoInfo.stargazers_count,
      lastCommit: lastCommitNode
        ? {
            sha: lastCommitNode.sha,
            message: lastCommitNode.commit.message.split('\n')[0],
            author: lastCommitNode.commit.author.name,
            authorAvatar: lastCommitNode.author?.avatar_url || '',
            date: lastCommitNode.commit.author.date,
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

  private extractRecentActivity(
    allCommitsREST: GitHubApiCommit[],
    allIssuesREST: GitHubApiIssue[],
    allPRsREST: GitHubApiPullRequest[],
  ): RecentActivity {
    const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const items: RecentActivityItem[] = [];

    const recentCommits = allCommitsREST.filter((commit) => {
      const commitDate = new Date(commit.commit.author.date);
      return commitDate >= since48h;
    });

    recentCommits.forEach((commit) => {
      items.push({
        type: 'commit',
        title: commit.commit.message.split('\n')[0],
        author: commit.commit.author.name,
        authorAvatar: commit.author?.avatar_url || '',
        date: commit.commit.author.date,
        url: commit.html_url,
        sha: commit.sha,
      });
    });

    const recentIssues = allIssuesREST.filter((issue) => {
      const issueDate = new Date(issue.created_at);
      return issueDate >= since48h;
    });

    recentIssues.forEach((issue) => {
      items.push({
        type: 'issue',
        title: issue.title,
        author: issue.user?.login || 'Unknown',
        authorAvatar: issue.user?.avatar_url || '',
        date: issue.created_at,
        url: issue.html_url,
        number: issue.number,
      });
    });

    const recentPRs = allPRsREST.filter((pr) => {
      const prDate = new Date(pr.created_at);
      return prDate >= since48h;
    });

    recentPRs.forEach((pr) => {
      items.push({
        type: 'pr',
        title: pr.title,
        author: pr.user?.login || 'Unknown',
        authorAvatar: pr.user?.avatar_url || '',
        date: pr.created_at,
        url: pr.html_url,
        number: pr.number,
      });
    });

    const sortedItems = items.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

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

  private calculateDailyStats(
    commits30d: Array<{ committedDate: string }>,
    issues30d: Array<{ createdAt: string }>,
    prs30d: Array<{ createdAt: string }>,
  ): DailyStats[] {
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

    commits30d.forEach((commit) => {
      const date = commit.committedDate.split('T')[0];
      if (dailyStatsMap[date]) {
        dailyStatsMap[date].commits++;
      }
    });

    issues30d.forEach((issue) => {
      const date = issue.createdAt.split('T')[0];
      if (dailyStatsMap[date]) {
        dailyStatsMap[date].issues++;
      }
    });

    prs30d.forEach((pr) => {
      const date = pr.createdAt.split('T')[0];
      if (dailyStatsMap[date]) {
        dailyStatsMap[date].prs++;
      }
    });

    return Object.values(dailyStatsMap).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  }

  private calculateWeeklyComparison(
    commits30d: Array<{ committedDate: string }>,
    issues30d: Array<{ createdAt: string }>,
    prs30d: Array<{ createdAt: string }>,
  ): WeeklyComparison {
    const now = new Date();
    now.setHours(23, 59, 59, 999);

    const week1Start = new Date(now);
    week1Start.setDate(now.getDate() - 7);
    week1Start.setHours(0, 0, 0, 0);
    const week1End = now;

    const week2Start = new Date(now);
    week2Start.setDate(now.getDate() - 14);
    week2Start.setHours(0, 0, 0, 0);
    const week2End = new Date(now);
    week2End.setDate(now.getDate() - 7);
    week2End.setHours(23, 59, 59, 999);

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
        return [];
      }

      const contributors = await response.json();

      return contributors
        .map((contrib: GitHubApiContributor) => ({
          username: contrib.login,
          commits: contrib.contributions,
          avatar: contrib.avatar_url,
          url: contrib.html_url || `https://github.com/${contrib.login}`,
        }))
        .sort((a: Contributor, b: Contributor) => b.commits - a.commits);
    } catch (error) {
      return [];
    }
  }

  private async fetchCommitsLast30Days(
    userId: number,
    owner: string,
    name: string,
  ): Promise<GitHubApiCommit[]> {
    try {
      const token = await this.getGitHubToken(userId);
      const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const sinceISO = since30d.toISOString();

      const allCommits: GitHubApiCommit[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await fetch(
          `https://api.github.com/repos/${owner}/${name}/commits?since=${sinceISO}&per_page=100&page=${page}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.github.v3+json',
            },
          },
        );

        if (!response.ok) {
          break;
        }

        const commits = (await response.json()) as GitHubApiCommit[];

        if (commits.length === 0) {
          hasMore = false;
        } else {
          allCommits.push(...commits);
          page++;

          const linkHeader = response.headers.get('Link');
          if (!linkHeader || !linkHeader.includes('rel="next"')) {
            hasMore = false;
          }
        }
      }

      return allCommits;
    } catch (error) {
      return [];
    }
  }

  async getRepoDetails(userId: number, repoId: number): Promise<RepoDashboard> {
    try {
      const repo = await this.getSelectedRepo(userId, repoId);
      const [owner, name] = repo.fullName.split('/');

      const [
        repoInfo,
        languages,
        contributors,
        allCommitsREST,
        allIssuesREST,
        allPRsREST,
      ] = await Promise.all([
        this.fetchRepoInfo(userId, owner, name),
        this.fetchRepoLanguages(userId, owner, name),
        this.fetchContributors(userId, owner, name),
        this.fetchCommitsLast30Days(userId, owner, name),
        this.fetchIssuesLast30Days(userId, owner, name),
        this.fetchPullRequestsLast30Days(userId, owner, name),
      ]);

      const commits30d = allCommitsREST.map((commit) => ({
        committedDate: commit.commit.author.date,
      }));

      const issues30d = allIssuesREST.map((issue) => ({
        createdAt: issue.created_at,
      }));

      const prs30d = allPRsREST.map((pr) => ({
        createdAt: pr.created_at,
      }));

      return {
        info: this.extractRepoInfo(
          repoInfo,
          languages,
          allCommitsREST,
          contributors.length,
          repo.htmlUrl,
          repoId,
        ),

        recentActivity: this.extractRecentActivity(
          allCommitsREST,
          allIssuesREST,
          allPRsREST,
        ),

        dailyStats: this.calculateDailyStats(commits30d, issues30d, prs30d),

        weeklyComparison: this.calculateWeeklyComparison(
          commits30d,
          issues30d,
          prs30d,
        ),

        contributors,
      };
    } catch (error) {
      throw error;
    }
  }
}
