import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { validateEnv } from './config/env';
import { DevModule } from './dev/dev.module';
import { GroupsModule } from './groups/groups.module';
import { HealthModule } from './health/health.module';
import { LineupsModule } from './lineups/lineups.module';
import { MatchModule } from './match/match.module';
import { PrismaModule } from './prisma/prisma.module';
import { RoundsModule } from './rounds/rounds.module';

@Module({
  imports: [
    // O .env fica na raiz do repositório (a API roda a partir de apps/api).
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env', validate: validateEnv }),
    PrismaModule,
    AuthModule,
    GroupsModule,
    HealthModule,
    RoundsModule,
    LineupsModule,
    MatchModule,
    DevModule.forEnvironment(),
  ],
})
export class AppModule {}
