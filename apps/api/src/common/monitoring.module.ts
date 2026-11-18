import { Injectable, Module, type OnApplicationBootstrap } from '@nestjs/common';
import { announceStartup } from './monitoring';

/** Na subida da API, avisa o Sentry (se ligado) que ela está no ar. */
@Injectable()
export class MonitoringAnnouncer implements OnApplicationBootstrap {
  onApplicationBootstrap(): void {
    announceStartup();
  }
}

@Module({ providers: [MonitoringAnnouncer] })
export class MonitoringModule {}
