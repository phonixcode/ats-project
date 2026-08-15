import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { databaseFile, databaseUrl, ensureDataDir } from '../common/paths';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    ensureDataDir();
    mkdirSync(dirname(databaseFile()), { recursive: true });
    const adapter = new PrismaBetterSqlite3({
      url: databaseUrl(),
    });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
