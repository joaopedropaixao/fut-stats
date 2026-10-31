import { resolve } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { validateEnv } from './config/env';
import { envFilePaths } from './config/env-files';
import { DevModule } from './dev/dev.module';
import { GroupsModule } from './groups/groups.module';
import { HealthModule } from './health/health.module';
import { LineupsModule } from './lineups/lineups.module';
import { PrismaModule } from './prisma/prisma.module';
import { RoundsModule } from './rounds/rounds.module';

@Module({
  imports: [
    // Os arquivos de ambiente ficam na raiz do repositório (a API roda a partir de apps/api).
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: envFilePaths(resolve(process.cwd(), '../..')),
      validate: validateEnv,
    }),
    PrismaModule,
    AuthModule,
    GroupsModule,
    HealthModule,
    RoundsModule,
    LineupsModule,
    DevModule.forEnvironment(),
  ],
})
export class AppModule {}
