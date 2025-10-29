import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';

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
    profile: any,
    done: any,
  ) {
    const user = {
      id: profile.id,
      githubId: profile.id,
      username: profile.username,
      avatar: profile.photos?.[0]?.value || profile._json?.avatar_url || '',
      email: profile.emails?.[0]?.value || profile._json?.email || '',
      refreshToken: refreshToken,
      accessToken: accessToken,
    };
    console.log('user dans la strategy github', user);
    done(null, user);
  }
}
