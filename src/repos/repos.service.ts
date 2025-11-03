import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  HttpException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import { UsersService } from '../users/users.service';
import type { GitHubRepo, StoredRepo } from './types/repos.types';

@Injectable()
export class ReposService {
  private dynamoDBClient: DynamoDBDocumentClient;
  private reposTableName: string;

  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    // Configuration du client DynamoDB pour la table Repos
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

  /**
   * Récupère tous les repos GitHub de l'utilisateur depuis l'API GitHub
   * @param userId - Le githubId de l'utilisateur
   * @returns La liste de tous les repos GitHub de l'utilisateur
   */
  private async getAllGitHubRepos(userId: string): Promise<GitHubRepo[]> {
    try {
      // 1. Récupérer l'utilisateur pour avoir son token GitHub
      const user = await this.usersService.findByGitHubId(userId);
      if (!user || !user.githubAccessToken) {
        throw new NotFoundException(
          'Token GitHub non trouvé pour cet utilisateur',
        );
      }

      // 2. Appeler l'API GitHub pour récupérer tous les repos
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

  /**
   * Récupère les repos GitHub disponibles (non sélectionnés) pour l'utilisateur connecté
   * @param userId - Le githubId de l'utilisateur
   * @returns La liste des repos GitHub qui ne sont pas encore enregistrés en BDD
   */
  async getAvailableGitHubRepos(userId: string): Promise<GitHubRepo[]> {
    try {
      // 1. Récupérer tous les repos GitHub
      const allRepos = await this.getAllGitHubRepos(userId);

      // 2. Récupérer les repos déjà sélectionnés en BDD
      const selectedReposResult = await this.dynamoDBClient.send(
        new QueryCommand({
          TableName: this.reposTableName,
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: {
            ':userId': userId,
          },
        }),
      );

      const selectedRepos = (selectedReposResult.Items || []) as StoredRepo[];
      const selectedRepoIds = selectedRepos.map((repo) => Number(repo.repoId));

      // 3. Filtrer pour ne garder que les repos non sélectionnés
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

  /**
   * Récupère les repos sélectionnés et enregistrés en BDD pour l'utilisateur
   * @param userId - Le githubId de l'utilisateur
   * @returns La liste des repos enregistrés en BDD
   */
  async getSelectedRepos(userId: string): Promise<StoredRepo[]> {
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

      return (result.Items || []) as StoredRepo[];
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

  /**
   * Enregistre les repos sélectionnés en BDD pour l'utilisateur
   * @param userId - Le githubId de l'utilisateur
   * @param repoIds - Les IDs des repos à enregistrer
   * @returns La liste des repos enregistrés
   */
  async saveSelectedRepos(
    userId: string,
    repoIds: number[],
  ): Promise<StoredRepo[]> {
    try {
      if (!repoIds || repoIds.length === 0) {
        throw new BadRequestException('Aucun ID de repo fourni');
      }

      // 1. Récupérer tous les repos GitHub de l'utilisateur
      const allRepos = await this.getAllGitHubRepos(userId);

      // 2. Filtrer pour ne garder que les repos dont l'ID est dans la liste fournie
      const reposToSave = allRepos.filter((repo) => repoIds.includes(repo.id));

      if (reposToSave.length === 0) {
        throw new NotFoundException(
          'Aucun repo trouvé correspondant aux IDs fournis',
        );
      }

      // 3. Enregistrer chaque repo dans DynamoDB
      const savedRepos: StoredRepo[] = [];
      for (const repo of reposToSave) {
        const repoItem: StoredRepo = {
          userId: userId,
          repoId: repo.id.toString(), // Convertir en string pour DynamoDB
          name: repo.name,
          full_name: repo.full_name,
          description: repo.description || '',
          html_url: repo.html_url,
          private: repo.private,
          language: repo.language || null,
          stargazers_count: repo.stargazers_count || 0,
          forks_count: repo.forks_count || 0,
          default_branch: repo.default_branch || 'main',
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

      return savedRepos;
    } catch (error) {
      console.error("Erreur lors de l'enregistrement des repos:", error);
      // Si c'est déjà une HttpException (BadRequest, NotFound, etc.), la relancer telle quelle
      if (error instanceof HttpException) {
        throw error;
      }
      // Sinon, transformer en erreur serveur
      throw new InternalServerErrorException(
        "Erreur lors de l'enregistrement des repos",
      );
    }
  }
}
