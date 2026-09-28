import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/api-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  const express = app.getHttpAdapter().getInstance();
  // JSON cho API; chunk nhi phan di stream rieng, khong qua parser.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  express.use('/api', require('express').json({ limit: '256kb' }));
  app.setGlobalPrefix('api/v1');
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new ApiExceptionFilter());
  // Serve file local: /media/<file> <- storage/hls (VOD sau transcode).
  const hlsDir = join(__dirname, '..', '..', 'storage', 'hls');
  mkdirSync(hlsDir, { recursive: true });
  app.useStaticAssets(hlsDir, { prefix: '/media/' });
  const port = Number(process.env.PORT || 3001);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`VTC ANY backend listening on :${port}`);
}
bootstrap();
