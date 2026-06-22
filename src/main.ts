import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Prefixo global da API
  app.setGlobalPrefix('api/v1');

  // ===== Limite do corpo da requisição =====
  // A importação de contatos do CRM (vCard .vcf) pode enviar arquivos
  // grandes (agendas com muitos contatos). O padrão do Express é 100kb,
  // o que causava erro "arquivo muito grande" (413). Elevamos para 25mb.
  app.use(json({ limit: '25mb' }));
  app.use(urlencoded({ limit: '25mb', extended: true }));

  // ===== Segurança de cabeçalhos HTTP =====
  app.use(helmet());

  // ===== CORS — endurecido =====
  // Em produção, exige CORS_ORIGIN explícito. Nunca libera "*" com credentials.
  const raw = (process.env.CORS_ORIGIN || '').trim();
  const isProd = process.env.NODE_ENV === 'production';

  if (!raw && isProd) {
    throw new Error(
      'CORS_ORIGIN não definido em produção. Defina as origens permitidas (separadas por vírgula).',
    );
  }

  const origins = raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const liberarTudo = origins.includes('*');
  if (liberarTudo && isProd) {
    throw new Error(
      'CORS_ORIGIN com "*" não é permitido em produção (incompatível com credentials).',
    );
  }

  app.enableCors({
    // Em dev sem config, libera tudo SEM credentials. Em produção, lista fixa.
    origin: liberarTudo ? true : origins.length ? origins : true,
    credentials: !liberarTudo,
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
  Logger.log(
    `Best Medical API rodando na porta ${port} (prefixo /api/v1)`,
    'Bootstrap',
  );
}
bootstrap();
