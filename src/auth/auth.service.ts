import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateGitHubUser(profile: any) {
    // Ici, vous pouvez ajouter la logique de stockage en BDD si nécessaire
    return {
      id: profile.id,
      githubId: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      profileUrl: profile.profileUrl,
      photos: profile.photos,
    };
  }

  async generateAccessToken(user: any): Promise<string> {
    const payload = {
      id: user.id,
      githubId: user.githubId,
      username: user.username,
      avatar: user.avatar,
      email: user.email,
      type: 'access',
    };
    const secret = this.configService.get<string>('JWT_SECRET') || '';
    // expiresIn: '30m', // Production : 30 minutes
    return this.jwtService.sign(payload, {
      secret,
      expiresIn: '5s', // Test : 5 secondes
    });
  }

  async generateRefreshToken(user: any): Promise<string> {
    // Refresh token : infos minimales nécessaires pour régénérer l'access token
    const payload = {
      id: user.id,
      githubId: user.githubId,
      username: user.username,
      avatar: user.avatar,
      email: user.email,
      type: 'refresh',
    };
    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      this.configService.get<string>('JWT_SECRET') ||
      '';
    // expiresIn: '7d', // Production : 7 jours
    return this.jwtService.sign(payload, {
      secret: refreshSecret,
      expiresIn: '1m', // Test : 1 minute
    });
  }

  async generateTokens(user: any) {
    const accessToken = await this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user);
    return { accessToken, refreshToken };
  }
}
