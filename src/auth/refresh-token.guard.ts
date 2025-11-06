import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class RefreshTokenGuard extends AuthGuard('refresh-token') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    // Si pas de user OU erreur OU info (token invalide/expiré)
    if (err || !user || info) {
      // Refresh token invalide/expiré/absent,  toujours le même message
      throw new UnauthorizedException('Refresh token JWT expiré');
    }
    return user;
  }
}
