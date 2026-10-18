import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@fut-stats/shared';

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    return { status: 'ok' };
  }
}
