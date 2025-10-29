import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  UnauthorizedException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(UnauthorizedException)
export class AuthExceptionFilter implements ExceptionFilter {
  catch(exception: UnauthorizedException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();

    // Détecter si c'est une erreur d'expiration de session
    const message = exception.message;
    const isTokenExpired =
      message.includes('jwt expired') ||
      message.includes('Unauthorized') ||
      message.includes('invalid token');

    response.status(status).json({
      statusCode: status,
      error: 'Unauthorized',
      code: isTokenExpired ? 'SESSION_EXPIRED' : 'UNAUTHORIZED',
      message: isTokenExpired
        ? 'Votre session a expiré, veuillez vous reconnecter'
        : 'Vous devez être authentifié pour accéder à cette ressource',
    });
  }
}
