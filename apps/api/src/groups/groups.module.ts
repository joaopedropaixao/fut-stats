import { Module } from '@nestjs/common';
import { GroupsController, InvitesController } from './groups.controller';
import { GroupsService } from './groups.service';

@Module({
  controllers: [GroupsController, InvitesController],
  providers: [GroupsService],
})
export class GroupsModule {}
