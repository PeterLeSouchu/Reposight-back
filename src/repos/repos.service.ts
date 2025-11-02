import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { UsersService } from '../users/users.service';

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
   * Récupère les repos GitHub disponibles (non sélectionnés) pour l'utilisateur connecté
   * @param userId - Le githubId de l'utilisateur
   * @returns La liste des repos GitHub qui ne sont pas encore enregistrés en BDD
   */
  async getAvailableGitHubRepos(userId: string): Promise<any[]> {
    try {
      // 1. Récupérer l'utilisateur pour avoir son token GitHub
      const user = await this.usersService.findByGitHubId(userId);
      if (!user || !user.githubAccessToken) {
        throw new Error('Token GitHub non trouvé pour cet utilisateur');
      }

      // 2. Appeler l'API GitHub pour récupérer tous les repos
      const response = await fetch('https://api.github.com/user/repos', {
        headers: {
          Authorization: `token ${user.githubAccessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new Error(
          `Erreur lors de la récupération des repos GitHub: ${response.statusText}`,
        );
      }

      const allRepos = await response.json();

      // 3. Récupérer les repos déjà sélectionnés en BDD
      const selectedReposResult = await this.dynamoDBClient.send(
        new QueryCommand({
          TableName: this.reposTableName,
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: {
            ':userId': userId,
          },
        }),
      );

      const selectedRepos = selectedReposResult.Items || [];
      const selectedRepoIds = selectedRepos.map((repo) => repo.repoId);

      // 4. Filtrer pour ne garder que les repos non sélectionnés
      const availableRepos = allRepos.filter(
        (repo) => !selectedRepoIds.includes(repo.id),
      );

      return availableRepos;
    } catch (error) {
      console.error('Erreur dans getAvailableGitHubRepos:', error);
      throw error;
    }
  }
}
