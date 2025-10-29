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

    // Détecter le type d'erreur
    const message = exception.message || '';
    const isAccessTokenExpired = message
      .toLowerCase()
      .includes('jwt access token expired');
    const isRefreshTokenExpired = message
      .toLowerCase()
      .includes('jwt refresh token expired');

    // Déterminer le code et message d'erreur
    let code: string;
    let errorMessage: string;

    if (isAccessTokenExpired) {
      // Cas 1 : Access token expiré → Frontend doit appeler /auth/refresh
      code = 'REFRESH_TOKEN';
      errorMessage = "Le token d'accès a expiré, veuillez le rafraîchir";
    } else if (isRefreshTokenExpired) {
      // Cas 2 : Refresh token expiré → Déconnexion complète
      code = 'SESSION_EXPIRED';
      errorMessage = 'Votre session a expiré, veuillez vous reconnecter';
    } else if (message) {
      // Cas 3 : Autre erreur avec message → renvoyer le message réel
      code = 'UNAUTHORIZED';
      errorMessage = message;
    } else {
      // Cas 4 : Pas de message → erreur inattendue
      code = 'UNAUTHORIZED';
      errorMessage = "Une erreur inattendue s'est produite";
    }

    response.status(status).json({
      statusCode: status,
      error: 'Unauthorized',
      code,
      message: errorMessage,
    });
  }
}
