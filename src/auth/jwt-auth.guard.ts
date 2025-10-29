import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    // Si pas de user OU erreur OU info (token invalide/expiré)
    if (err || !user || info) {
      throw new UnauthorizedException(
        err?.message || info?.message || 'jwt expired',
      );
    }
    return user;
  }
}
