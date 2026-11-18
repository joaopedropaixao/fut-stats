import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Put,
} from '@nestjs/common';
import {
  pushSubscriptionInputSchema,
  pushUnsubscribeSchema,
  type PushConfig,
  type PushSubscriptionInput,
  type PushTestResult,
  type PushUnsubscribeInput,
  type SessionUser,
} from '@fut-stats/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PushService } from './push.service';

/** Cabeça do user agent que vale guardar (ajuda a reconhecer o aparelho; não é identificador). */
const USER_AGENT_MAX = 300;

/** Avisos push do usuário logado, por aparelho (vale para todas as peladas dele). Sem rota de grupo. */
@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Get('config')
  config(): PushConfig {
    return this.push.getConfig();
  }

  @Put('subscriptions')
  @HttpCode(HttpStatus.NO_CONTENT)
  async subscribe(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(pushSubscriptionInputSchema)) body: PushSubscriptionInput,
    @Headers('user-agent') userAgent?: string,
  ): Promise<void> {
    await this.push.subscribe(user.id, body, userAgent?.slice(0, USER_AGENT_MAX) || null);
  }

  @Delete('subscriptions')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsubscribe(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(pushUnsubscribeSchema)) body: PushUnsubscribeInput,
  ): Promise<void> {
    await this.push.unsubscribe(user.id, body.endpoint);
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  test(@CurrentUser() user: SessionUser): Promise<PushTestResult> {
    return this.push.sendTest(user.id);
  }
}
