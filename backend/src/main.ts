import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync } from 'fs';
import { AppModule } from './app.module';
import { ensureDataDir } from './common/paths';

async function bootstrap() {
  ensureDataDir();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({
    origin: true,
    exposedHeaders: ['Content-Disposition'],
  });

  const staticDir = process.env.MG_ATS_STATIC;
  if (staticDir && existsSync(staticDir)) {
    app.useStaticAssets(staticDir);
  }

  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, host);
  const address = app.getHttpServer().address();
  const bound =
    typeof address === 'object' && address
      ? address.port
      : port;
  Logger.log(`MG_ATS_READY http://${host}:${bound}`);
}

bootstrap();
