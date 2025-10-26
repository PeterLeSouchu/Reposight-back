import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: any) => {
          return request?.cookies?.jwt || null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey:
        process.env.JWT_SECRET ||
        '3Ofwwe0xDimXYUTrto/AL7YGz+0Z4xywAM55g+OPLJird9kNeFCVZNYYG+pl90Xj',
    });
  }

  async validate(payload: any) {
    return { id: payload.id, githubId: payload.githubId };
  }
}
