import { Module } from '@nestjs/common';
import { OrcamentosService } from './orcamentos.service';
import { OrcamentosController } from './orcamentos.controller';
import { PdfService } from './pdf/pdf.service';

@Module({
  controllers: [OrcamentosController],
  providers: [OrcamentosService, PdfService],
})
export class OrcamentosModule {}
