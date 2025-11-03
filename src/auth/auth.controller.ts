import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RefreshTokenGuard } from './refresh-token.guard';
import { UsersService } from '../users/users.service';
import type { AuthenticatedUser, RequestWithUser } from './types/auth.types';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
    private usersService: UsersService,
  ) {}

  @Get('github')
  @UseGuards(AuthGuard('github'))
  async githubAuth() {
    // Nécessaire pour déclarer la route GET /auth/github
    // La redirection se fait automatiquement par Passport
  }

  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  async githubCallback(
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ): Promise<void> {
    const user = req.user;

    // Vérifier si l'utilisateur existe déjà en DynamoDB
    const existingUser = await this.usersService.findByGitHubId(user.githubId);

    // Si l'utilisateur n'existe pas, le créer avec le token GitHub
    if (!existingUser) {
      await this.usersService.create({
        githubId: user.githubId,
        username: user.username,
        email: user.email || '',
        avatar: user.avatar || '',
        githubAccessToken: user.accessToken || '',
      });
    } else {
      // Mettre à jour les infos utilisateur et le token GitHub (le token change à chaque reconnexion)
      await this.usersService.update(user.githubId, {
        username: user.username,
        email: user.email || '',
        avatar: user.avatar || '',
        githubAccessToken: user.accessToken || '',
      });
    }

    // Générer les tokens (utilise les données du user GitHub)
    const { accessToken, refreshToken } =
      await this.authService.generateTokens(user);

    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );

    // Refresh token
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
    });

    return res.redirect(`${frontendUrl}/dashboard`);
  }

  @Post('refresh')
  @UseGuards(RefreshTokenGuard)
  async refreshToken(
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ): Promise<Response> {
    const user = req.user;

    // Générer de nouveaux tokens avec les infos du refresh token
    const { accessToken, refreshToken: newRefreshToken } =
      await this.authService.generateTokens(user);

    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    res.cookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
    });

    return res.json({
      message: 'Tokens refreshed successfully',
      accessToken,
    });
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@Res() res: Response): Response {
    console.log('logoutssssss');
    res.clearCookie('refresh_token');
    return res.json({ message: 'Déconnexion réussie' });
  }
}
