import { resolve } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { MonitoringModule } from './common/monitoring.module';
import { validateEnv } from './config/env';
import { envFilePaths } from './config/env-files';
import { DevModule } from './dev/dev.module';
import { RoundEventsModule } from './events/round-events.module';
import { FeedModule } from './feed/feed.module';
import { GroupsModule } from './groups/groups.module';
import { HealthModule } from './health/health.module';
import { HistoryModule } from './history/history.module';
import { InternalModule } from './internal/internal.module';
import { LineupsModule } from './lineups/lineups.module';
import { LiveModule } from './live/live.module';
import { MatchModule } from './match/match.module';
import { PrismaModule } from './prisma/prisma.module';
import { PushModule } from './push/push.module';
import { RankingModule } from './ranking/ranking.module';
import { RoundsModule } from './rounds/rounds.module';
import { VotingModule } from './voting/voting.module';

@Module({
  imports: [
    // Os arquivos de ambiente ficam na raiz do repositório (a API roda a partir de apps/api).
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: envFilePaths(resolve(process.cwd(), '../..')),
      validate: validateEnv,
    }),
    MonitoringModule,
    PrismaModule,
    AuthModule,
    GroupsModule,
    HealthModule,
    RoundsModule,
    LineupsModule,
    MatchModule,
    HistoryModule,
    VotingModule,
    RankingModule,
    FeedModule,
    AuditModule,
    RoundEventsModule,
    LiveModule,
    PushModule,
    DevModule.forEnvironment(),
    InternalModule.forEnvironment(),
  ],
})
export class AppModule {}
