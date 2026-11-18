import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { VotingModule } from '../voting/voting.module';

@Module({
  imports: [AuditModule, VotingModule],
  controllers: [FeedController, PostsController],
  providers: [FeedService, PostsService],
})
export class FeedModule {}
