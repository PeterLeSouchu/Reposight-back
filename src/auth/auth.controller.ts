import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RefreshTokenGuard } from './refresh-token.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Get('github')
  @UseGuards(AuthGuard('github'))
  async githubAuth() {
    // Nécessaire pour déclarer la route GET /auth/github
    // La redirection se fait automatiquement par Passport
  }

  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  async githubCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as any;
    const { accessToken, refreshToken } =
      await this.authService.generateTokens(user);

    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );

    // Access token
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      // maxAge: 30 * 60 * 1000, // Production : 30 minutes
      maxAge: 5 * 1000, // Test : 5 secondes
    });

    // Refresh token
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      // maxAge: 7 * 24 * 60 * 60 * 1000, // Production : 7 jours
      maxAge: 60 * 1000, // Test : 1 minute
    });

    return res.redirect(`${frontendUrl}/dashboard`);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: Request) {
    return req.user;
  }

  @Post('refresh')
  @UseGuards(RefreshTokenGuard)
  async refreshToken(@Req() req: Request, @Res() res: Response) {
    console.log('on est dans la route refresh token');
    const user = req.user as any;

    // Générer de nouveaux tokens avec les infos du refresh token
    const { accessToken, refreshToken: newRefreshToken } =
      await this.authService.generateTokens(user);

    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      // maxAge: 30 * 60 * 1000, // Production : 30 minute
      maxAge: 5 * 1000, // Test : 5 secondes
    });

    res.cookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      // maxAge: 7 * 24 * 60 * 60 * 1000, // Production : 7 jours
      maxAge: 60 * 1000, // Test : 1 minute
    });

    console.log("c'est fini");
    return res.json({
      message: 'Tokens refreshed successfully',
    });
  }

  @Post('logout')
  logout(@Res() res: Response) {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return res.json({ message: 'Déconnexion réussie' });
  }
}
