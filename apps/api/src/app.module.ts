import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { validateEnv } from './config/env';
import { GroupsModule } from './groups/groups.module';
import { HealthModule } from './health/health.module';
import { LineupsModule } from './lineups/lineups.module';
import { PrismaModule } from './prisma/prisma.module';
import { RoundsModule } from './rounds/rounds.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    AuthModule,
    GroupsModule,
    HealthModule,
    LineupsModule,
    RoundsModule,
  ],
})
export class AppModule {}
