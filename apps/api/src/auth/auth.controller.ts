import { Controller, Get, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import type { MeResponse, SessionUser } from '@fut-stats/shared';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { Public } from './public.decorator';
import { SessionService } from './session.service';

@Controller()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Get('me')
  me(@CurrentUser() user: SessionUser): Promise<MeResponse> {
    return this.auth.me(user);
  }

  // Público: com a sessão já expirada, o logout ainda limpa o cookie.
  @Public()
  @Post('auth/logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) res: Response): void {
    this.sessions.clearSession(res);
  }
}
