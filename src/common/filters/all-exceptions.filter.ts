import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Vérifier si l'erreur est une instance de HttpException
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        response.status(status).json({
          statusCode: status,
          message: exceptionResponse,
        });
      } else {
        response.status(status).json(exceptionResponse);
      }
    } else {
      // Sinon, renvoyer une erreur serveur générique pour eviter de renvoyer des erreurs sensibles au front.
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Erreur serveur interne',
        error: 'Internal Server Error',
      });
    }
  }
}
