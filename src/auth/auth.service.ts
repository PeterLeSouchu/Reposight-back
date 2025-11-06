import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  AuthenticatedUser,
  JwtAccessPayload,
  JwtRefreshPayload,
} from './types/auth.types';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async generateAccessToken(user: AuthenticatedUser): Promise<string> {
    const payload: JwtAccessPayload = {
      githubId: user.githubId,
      type: 'access',
    };
    const secret = this.configService.get<string>('JWT_SECRET') || '';
    return this.jwtService.sign(payload, {
      secret,
      expiresIn: '15m', // 15 minutes
    });
  }

  async generateRefreshToken(user: AuthenticatedUser): Promise<string> {
    const payload: JwtRefreshPayload = {
      githubId: user.githubId,
      type: 'refresh',
    };
    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      this.configService.get<string>('JWT_SECRET') ||
      '';
    return this.jwtService.sign(payload, {
      secret: refreshSecret,
      expiresIn: '7d', // 7 jours
    });
  }

  async generateTokens(
    user: AuthenticatedUser,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = await this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user);
    return { accessToken, refreshToken };
  }
}
