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
}
