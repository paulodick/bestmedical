import { Module } from '@nestjs/common';
import { ContratosService } from './contratos.service';
import { ContratosController } from './contratos.controller';
import { PropostaPdfService } from './pdf/proposta-pdf.service';
import { EmailModule } from '../email/email.module';

@Module({
  // EmailModule é @Global, mas o importamos explicitamente para deixar claro o
  // vínculo de dependência (EmailService é usado no envio da proposta).
  imports: [EmailModule],
  controllers: [ContratosController],
  providers: [ContratosService, PropostaPdfService],
})
export class ContratosModule {}
