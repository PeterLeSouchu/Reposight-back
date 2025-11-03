import {
  Controller,
  Delete,
  Get,
  Req,
  Res,
  UseGuards,
  NotFoundException,
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

    // Récupérer l'utilisateur complet depuis DynamoDB
    const dbUser = await this.usersService.findByGitHubId(githubId);

    if (!dbUser) {
      throw new NotFoundException('Utilisateur non trouvé en base de données');
    }

    // Retourner uniquement les champs demandés
    return {
      avatar: dbUser.avatar,
      username: dbUser.username,
      email: dbUser.email,
    };
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  async deleteAccount(
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ): Promise<Response> {
    const githubId = req.user.githubId;

    // 1. Vérifier que l'utilisateur existe
    const dbUser = await this.usersService.findByGitHubId(githubId);
    if (!dbUser) {
      throw new NotFoundException('Utilisateur non trouvé en base de données');
    }

    // 2. Supprimer tous les repos de l'utilisateur
    await this.reposService.deleteAllReposByUserId(githubId);

    // 3. Supprimer l'utilisateur
    await this.usersService.delete(githubId);

    // 4. Nettoyer le cookie refresh_token (avec les mêmes options que lors de la création)
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: isProduction, // true seulement en production (HTTPS)
      sameSite: isProduction ? 'none' : 'lax', // 'none' pour cross-site en prod, 'lax' en dev
    });

    return res.json({
      message: 'Compte utilisateur et tous ses repos supprimés avec succès',
    });
  }
}
