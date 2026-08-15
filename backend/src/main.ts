import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync, writeFileSync, writeSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';
import { dataDir, ensureDataDir } from './common/paths';
import { runMigrations } from './common/migrate';

function announceReady(url: string): void {
  writeFileSync(join(dataDir(), 'api.ready'), url, 'utf8');
  const line = `MG_ATS_READY ${url}\n`;
  try {
    writeSync(1, line);
  } catch {
    process.stdout.write(line);
  }
}

async function bootstrap() {
  ensureDataDir();
  runMigrations();
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
  announceReady(`http://${host}:${bound}`);
}

bootstrap();
