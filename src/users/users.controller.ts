import {
  Controller,
  Delete,
  Get,
  Patch,
  Req,
  Res,
  UseGuards,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { UsersService } from './users.service';
import { ReposService } from '../repos/repos.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestWithUser } from '../auth/types/auth.types';
import type { UserProfileResponse } from './types/users.types';

@Controller('user')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private reposService: ReposService,
    private configService: ConfigService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: RequestWithUser): Promise<UserProfileResponse> {
    const githubId = req.user.githubId;

    const dbUser = await this.usersService.findUserByGithubId(githubId);

    if (!dbUser) {
      throw new NotFoundException('Utilisateur non trouvé en base de données');
    }

    const githubToken = dbUser.githubAccessToken;
    if (!githubToken) {
      throw new NotFoundException(
        'Token GitHub non trouvé pour cet utilisateur',
      );
    }

    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new InternalServerErrorException(
          `Erreur lors de la récupération des données GitHub: ${response.statusText}`,
        );
      }

      const githubUser = await response.json();

      return {
        avatar: githubUser.avatar_url || '',
        username: githubUser.login || '',
        email: githubUser.email || '',
        isNewUser: dbUser.isNewUser ?? false,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Erreur lors de la récupération du profil utilisateur',
      );
    }
  }

  @Patch('steps')
  @UseGuards(JwtAuthGuard)
  async completeSteps(@Req() req: RequestWithUser) {
    const githubId = req.user.githubId;

    const dbUser = await this.usersService.findUserByGithubId(githubId);
    if (!dbUser) {
      throw new NotFoundException('Utilisateur non trouvé en base de données');
    }

    await this.usersService.update(githubId, {
      isNewUser: false,
    });

    return {
      message: 'Stepper terminé avec succès',
    };
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  async deleteAccount(
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ): Promise<Response> {
    const githubId = req.user.githubId;

    const dbUser = await this.usersService.findUserByGithubId(githubId);
    if (!dbUser) {
      throw new NotFoundException('Utilisateur non trouvé en base de données');
    }

    await this.reposService.deleteAllReposByUserId(githubId);

    await this.usersService.delete(githubId);

    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
    });

    return res.json({
      message: 'Compte utilisateur et tous ses repos supprimés avec succès',
    });
  }
}
