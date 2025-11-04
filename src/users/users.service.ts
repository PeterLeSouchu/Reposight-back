import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import type {
  CreateUserDto,
  UpdateUserDto,
  User,
  DynamoDBUser,
} from './types/users.types';

@Injectable()
export class UsersService {
  private dynamoDBClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor(private configService: ConfigService) {
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

  async findByGitHubId(githubId: string | number): Promise<User | null> {
    try {
      const githubIdNumber = Number(githubId);

      const result = await this.dynamoDBClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            github_id: githubIdNumber,
          },
        }),
      );

      if (result.Item) {
        const item = result.Item as DynamoDBUser;
        return {
          ...item,
          githubId: item.github_id,
        } as User;
      }
      return null;
    } catch (error) {
      console.error("Erreur lors de la recherche de l'utilisateur:", error);
      throw new InternalServerErrorException(
        "Erreur lors de la recherche de l'utilisateur",
      );
    }
  }

  async create(userData: CreateUserDto): Promise<User> {
    try {
      const githubIdNumber = Number(userData.githubId);

      const user: DynamoDBUser = {
        github_id: githubIdNumber,
        username: userData.username,
        email: userData.email,
        avatar: userData.avatar,
        githubAccessToken: userData.githubAccessToken || '',
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

      return {
        ...user,
        githubId: user.github_id,
      } as User;
    } catch (error) {
      console.error("Erreur lors de la création de l'utilisateur:", error);
      throw new InternalServerErrorException(
        "Erreur lors de la création de l'utilisateur",
      );
    }
  }

  async update(
    githubId: string | number,
    updateData: UpdateUserDto,
  ): Promise<User> {
    try {
      const updateExpression: string[] = [];
      const expressionAttributeValues: Record<string, unknown> = {};
      const expressionAttributeNames: Record<string, string> = {};

      if (updateData.githubAccessToken !== undefined) {
        updateExpression.push('#token = :token');
        expressionAttributeNames['#token'] = 'githubAccessToken';
        expressionAttributeValues[':token'] = updateData.githubAccessToken;
      }

      if (updateData.username !== undefined) {
        updateExpression.push('#username = :username');
        expressionAttributeNames['#username'] = 'username';
        expressionAttributeValues[':username'] = updateData.username;
      }

      if (updateData.email !== undefined) {
        updateExpression.push('#email = :email');
        expressionAttributeNames['#email'] = 'email';
        expressionAttributeValues[':email'] = updateData.email;
      }

      if (updateData.avatar !== undefined) {
        updateExpression.push('#avatar = :avatar');
        expressionAttributeNames['#avatar'] = 'avatar';
        expressionAttributeValues[':avatar'] = updateData.avatar;
      }

      // Toujours mettre à jour updatedAt
      updateExpression.push('#updatedAt = :updatedAt');
      expressionAttributeNames['#updatedAt'] = 'updatedAt';
      expressionAttributeValues[':updatedAt'] = new Date().toISOString();

      // Convertir en number pour DynamoDB
      const githubIdNumber = Number(githubId);

      const result = await this.dynamoDBClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: {
            github_id: githubIdNumber,
          },
          UpdateExpression: `SET ${updateExpression.join(', ')}`,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
          ReturnValues: 'ALL_NEW',
        }),
      );

      // Mapper les données DynamoDB (github_id -> githubId)
      if (result.Attributes) {
        const item = result.Attributes as DynamoDBUser;
        return {
          ...item,
          githubId: item.github_id,
        } as User;
      }
      throw new InternalServerErrorException(
        'Aucun attribut retourné lors de la mise à jour',
      );
    } catch (error) {
      console.error("Erreur lors de la mise à jour de l'utilisateur:", error);
      throw new InternalServerErrorException(
        "Erreur lors de la mise à jour de l'utilisateur",
      );
    }
  }

  async delete(githubId: string | number): Promise<void> {
    try {
      const githubIdNumber = Number(githubId);

      await this.dynamoDBClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: {
            github_id: githubIdNumber,
          },
        }),
      );
    } catch (error) {
      console.error("Erreur lors de la suppression de l'utilisateur:", error);
      throw new InternalServerErrorException(
        "Erreur lors de la suppression de l'utilisateur",
      );
    }
  }
}
