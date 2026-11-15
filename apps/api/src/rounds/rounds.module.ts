import { Module } from '@nestjs/common';
import { VotingModule } from '../voting/voting.module';
import { RoundsController } from './rounds.controller';
import { RoundsService } from './rounds.service';

@Module({
  imports: [VotingModule],
  controllers: [RoundsController],
  providers: [RoundsService],
})
export class RoundsModule {}
