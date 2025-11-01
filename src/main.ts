import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { AuthExceptionFilter } from './auth/exceptions/auth-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  // Configuration CORS pour permettre les cookies cross-domain
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // Appliquer le filter globalement pour toutes les erreurs d'authentification
  app.useGlobalFilters(new AuthExceptionFilter());

  await app.listen(process.env.PORT ?? 3001);
  console.log('Server is running on port', process.env.PORT ?? 3001);
}
bootstrap();
