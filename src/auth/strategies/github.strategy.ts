import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor() {
    super({
      clientID: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      callbackURL: process.env.CALLBACK_URL || '',
      scope: ['read:user', 'user:email', 'repo'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: any,
  ) {
    // Retourner directement le profile GitHub
    const user = {
      id: profile.id,
      githubId: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      profileUrl: profile.profileUrl,
      photos: profile.photos,
    };
    done(null, user);
  }
}
