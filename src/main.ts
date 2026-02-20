import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'https://reposight.peterlesouchu.com',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  const config = new DocumentBuilder()
    .setTitle('Reposight API')
    .setDescription('API de Reposight. Pour tester les endpoints, vous pouvez utiliser l\'application front-end disponible à l\'adresse suivante: https://reposight.peterlesouchu.com. Connectez-vous, et récupérer l\'acces token en ouvrant les devtools, et en regardant la response de la requête refresh.')
    .setVersion('1.0')
    .addBearerAuth()
    .addCookieAuth('refresh_token')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 8080, '0.0.0.0');
  console.log('process.env.FRONTEND_URL',process.env.FRONTEND_URL);
}
bootstrap();
