import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';

@Injectable()
export class UsersService {
  private dynamoDBClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor(private configService: ConfigService) {
    // Configuration du client DynamoDB
    const client = new DynamoDBClient({
      region: this.configService.get<string>('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || '',
        secretAccessKey:
          this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '',
      },
    });

    this.dynamoDBClient = DynamoDBDocumentClient.from(client);
    this.tableName =
      this.configService.get<string>('DYNAMO_USERS_TABLE') || 'Users';
  }

  /**
   * Trouve un utilisateur par son githubId
   * @param githubId - L'identifiant GitHub de l'utilisateur
   * @returns L'utilisateur s'il existe, null sinon
   */
  async findByGitHubId(githubId: string | number): Promise<any | null> {
    try {
      const result = await this.dynamoDBClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            githubId: githubId.toString(), // Convertir en string pour être sûr
          },
        }),
      );

      return result.Item || null;
    } catch (error) {
      console.error("Erreur lors de la recherche de l'utilisateur:", error);
      throw error;
    }
  }

  /**
   * Crée un nouvel utilisateur en DynamoDB
   * @param userData - Les données de l'utilisateur à créer
   * @returns L'utilisateur créé
   */
  async create(userData: {
    githubId: string | number;
    username: string;
    email: string;
    avatar: string;
  }): Promise<any> {
    try {
      const user = {
        githubId: userData.githubId.toString(),
        username: userData.username,
        email: userData.email,
        avatar: userData.avatar,
        repos: [],
        favorites: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await this.dynamoDBClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: user,
        }),
      );

      return user;
    } catch (error) {
      console.error("Erreur lors de la création de l'utilisateur:", error);
      throw error;
    }
  }
}
