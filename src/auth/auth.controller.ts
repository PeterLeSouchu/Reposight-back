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
  ): Promise<Response> {
    const user = req.user;

    const existingUser = await this.usersService.findUserByGithubId(
      user.githubId,
    );

    if (!existingUser) {
      await this.usersService.create({
        githubId: user.githubId,
        githubAccessToken: user.accessToken || '',
      });
    } else {
      await this.usersService.update(user.githubId, {
        githubAccessToken: user.accessToken || '',
      });
    }

    const { refreshToken } = await this.authService.generateTokens(user);

    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );

    // Refresh token
    // En production: secure: true + sameSite: 'none' (HTTPS + cross-site)
    // En dev: secure: false + sameSite: 'lax' (HTTP local, fonctionne même cross-origin en localhost)
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction, // true seulement en production (HTTPS)
      sameSite: isProduction ? 'none' : 'lax', // 'none' pour cross-site en prod, 'lax' en dev
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
    });

    return res.json({
      message: 'Authentication successful',
    });
  }

  @Post('refresh')
  @UseGuards(RefreshTokenGuard)
  async refreshToken(
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ): Promise<Response> {
    const user = req.user;

    const { accessToken, refreshToken: newRefreshToken } =
      await this.authService.generateTokens(user);

    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    // En production: secure: true + sameSite: 'none' (HTTPS + cross-site)
    // En dev: secure: false + sameSite: 'lax' (HTTP local)
    res.cookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: isProduction, // true seulement en production (HTTPS)
      sameSite: isProduction ? 'none' : 'lax', // 'none' pour cross-site en prod, 'lax' en dev
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
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: isProduction, // true seulement en production (HTTPS)
      sameSite: isProduction ? 'none' : 'lax', // 'none' pour cross-site en prod, 'lax' en dev
    });
    return res.json({ message: 'Déconnexion réussie' });
  }
}
