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
import type { User } from './types/users.types';

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

  async findUserByGithubId(githubId: number): Promise<User | null> {
    try {
      const result = await this.dynamoDBClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            githubId: githubId,
          },
        }),
      );

      if (!result.Item) {
        return null;
      }
      return result.Item as User;
    } catch (error) {
      throw new InternalServerErrorException(
        "Erreur lors de la recherche de l'utilisateur",
      );
    }
  }

  async create(userData: Partial<User> & { githubId: number }): Promise<User> {
    try {
      const now = new Date().toISOString();

      const user: User = {
        githubId: userData.githubId,
        githubAccessToken: userData.githubAccessToken || '',
        isNewUser: true,
        createdAt: now,
        updatedAt: now,
      };

      await this.dynamoDBClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: user,
        }),
      );

      return user;
    } catch (error) {
      throw new InternalServerErrorException(
        "Erreur lors de la création de l'utilisateur",
      );
    }
  }

  async update(githubId: number, updateData: Partial<User>): Promise<User> {
    try {
      const updateExpression: string[] = [];
      const expressionAttributeValues: {
        [key: string]: string | boolean;
      } = {};
      const expressionAttributeNames: { [key: string]: string } = {};

      if (updateData.githubAccessToken !== undefined) {
        updateExpression.push('#token = :token');
        expressionAttributeNames['#token'] = 'githubAccessToken';
        expressionAttributeValues[':token'] = updateData.githubAccessToken;
      }

      if (updateData.isNewUser !== undefined) {
        updateExpression.push('#isNewUser = :isNewUser');
        expressionAttributeNames['#isNewUser'] = 'isNewUser';
        expressionAttributeValues[':isNewUser'] = updateData.isNewUser;
      }

      updateExpression.push('#updatedAt = :updatedAt');
      expressionAttributeNames['#updatedAt'] = 'updatedAt';
      expressionAttributeValues[':updatedAt'] = new Date().toISOString();

      const result = await this.dynamoDBClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: {
            githubId: githubId,
          },
          UpdateExpression: `SET ${updateExpression.join(', ')}`,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
          ReturnValues: 'ALL_NEW',
        }),
      );

      if (result.Attributes) {
        return result.Attributes as User;
      }
      throw new InternalServerErrorException(
        'Aucun attribut retourné lors de la mise à jour',
      );
    } catch (error) {
      throw new InternalServerErrorException(
        "Erreur lors de la mise à jour de l'utilisateur",
      );
    }
  }

  async delete(githubId: number): Promise<void> {
    try {
      await this.dynamoDBClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: {
            githubId: githubId,
          },
        }),
      );
    } catch (error) {
      throw new InternalServerErrorException(
        "Erreur lors de la suppression de l'utilisateur",
      );
    }
  }
}
