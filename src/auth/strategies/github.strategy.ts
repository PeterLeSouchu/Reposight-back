import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import {
  AuthenticatedUser,
  GitHubProfile,
  PassportDoneCallback,
} from '../types/auth.types';

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(private configService: ConfigService) {
    super({
      clientID: configService.get<string>('GITHUB_CLIENT_ID') || '',
      clientSecret: configService.get<string>('GITHUB_CLIENT_SECRET') || '',
      callbackURL: configService.get<string>('CALLBACK_URL') || '',
      scope: ['read:user', 'user:email', 'repo'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: GitHubProfile,
    done: PassportDoneCallback,
  ): Promise<void> {
    // Convertir profile.id en number (l'API GitHub renvoie number mais Passport peut le convertir en string)
    const githubId =
      typeof profile.id === 'string' ? Number(profile.id) : profile.id;

    const user: AuthenticatedUser = {
      id: githubId,
      githubId: githubId,
      username: profile.username,
      avatar: profile.photos?.[0]?.value || profile._json?.avatar_url || '',
      email: profile.emails?.[0]?.value || profile._json?.email || '',
      refreshToken: refreshToken,
      accessToken: accessToken,
    };
    console.log('user github strategy', user);

    done(null, user);
  }
}
