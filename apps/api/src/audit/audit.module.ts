import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

/** Registro da rodada: quem grava (`AuditService.record`, dentro da transação de quem muda a rodada) e quem lê (admin). */
@Module({
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
