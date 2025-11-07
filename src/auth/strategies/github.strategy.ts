import { Injectable, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(GitHubStrategy.name);

  constructor(private configService: ConfigService) {
    const callbackURL = configService.get<string>('CALLBACK_URL') || '';

    super({
      clientID: configService.get<string>('GITHUB_CLIENT_ID') || '',
      clientSecret: configService.get<string>('GITHUB_CLIENT_SECRET') || '',
      callbackURL,
      scope: ['read:user', 'user:email', 'repo'],
    });

    this.logger.debug(`GitHub callbackURL: ${callbackURL || '[empty]'}`);
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
      githubId: githubId,
      accessToken: accessToken,
    };

    done(null, user);
  }
}
