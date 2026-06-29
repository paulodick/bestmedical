import { Module } from '@nestjs/common';
import { ContratosService } from './contratos.service';
import { ContratosController } from './contratos.controller';
import { PropostaPdfService } from './pdf/proposta-pdf.service';
import { ContratoService } from './contrato.service';
import { ContratoController } from './contrato.controller';
import { ContratoPdfService } from './pdf/contrato-pdf.service';
import { EmailModule } from '../email/email.module';

@Module({
  // EmailModule é @Global, mas o importamos explicitamente para deixar claro o
  // vínculo de dependência (EmailService é usado no envio da proposta/contrato).
  imports: [EmailModule],
  controllers: [ContratosController, ContratoController],
  providers: [
    ContratosService,
    PropostaPdfService,
    ContratoService,
    ContratoPdfService,
  ],
})
export class ContratosModule {}
