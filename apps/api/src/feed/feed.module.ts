import { Module } from '@nestjs/common';
import { VotingModule } from '../voting/voting.module';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  // Os avisos fecham a votação vencida antes de responder, como a lista de rodadas.
  imports: [VotingModule],
  controllers: [FeedController, PostsController],
  providers: [FeedService, PostsService],
})
export class FeedModule {}
