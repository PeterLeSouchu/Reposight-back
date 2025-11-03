import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {
  AuthenticatedUser,
  JwtRefreshPayload,
  RequestWithRefreshToken,
} from '../types/auth.types';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'refresh-token',
) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: RequestWithRefreshToken): string | null => {
          return (
            request?.body?.refreshToken ||
            request?.cookies?.refresh_token ||
            null
          );
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_REFRESH_SECRET') || '',
    });
  }

  async validate(payload: JwtRefreshPayload): Promise<AuthenticatedUser> {
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }
    return {
      id: payload.id,
      githubId: payload.githubId,
      username: payload.username,
      avatar: payload.avatar,
      email: payload.email,
    };
  }
}
