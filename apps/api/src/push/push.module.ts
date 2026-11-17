import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PushController } from './push.controller';
import { PushSender } from './push-sender';
import { PushService } from './push.service';
import { WebPushSender } from './web-push-sender';

/** Avisos push: assinaturas por aparelho, `NotificationsService` (exportado) e o enviador (`PushSender`). */
@Module({
  controllers: [PushController],
  providers: [PushService, NotificationsService, { provide: PushSender, useClass: WebPushSender }],
  exports: [NotificationsService],
})
export class PushModule {}
