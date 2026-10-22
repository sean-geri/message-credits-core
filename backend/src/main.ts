import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = readPort(configService);

  await app.listen(port);
  Logger.log(`Application listening on port ${port}`, 'Bootstrap');
}

function readPort(configService: ConfigService): number {
  const rawPort = configService.get<string>('PORT', '3000');
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `Invalid PORT "${rawPort}". Expected an integer from 1 to 65535.`,
    );
  }

  return port;
}

bootstrap();
