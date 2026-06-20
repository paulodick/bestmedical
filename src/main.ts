import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Prefixo global da API
  app.setGlobalPrefix('api/v1');

  // CORS — libera o front-end (configurável via CORS_ORIGIN)
  const origins = (process.env.CORS_ORIGIN || '*')
    .split(',')
    .map((o) => o.trim());
  app.enableCors({
    origin: origins.includes('*') ? true : origins,
    credentials: true,
  });

  // Validação automática de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`Best Medical API rodando na porta ${port} (prefixo /api/v1)`);
}
bootstrap();
