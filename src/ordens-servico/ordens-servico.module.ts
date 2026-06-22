import { Module } from '@nestjs/common';
import { OrdensServicoService } from './ordens-servico.service';
import { OrdensServicoController } from './ordens-servico.controller';
import { OsPdfService } from './pdf/os-pdf.service';

@Module({
  controllers: [OrdensServicoController],
  providers: [OrdensServicoService, OsPdfService],
  // Exporta o service para que o OrcamentosModule possa injetá-lo
  exports: [OrdensServicoService],
})
export class OrdensServicoModule {}
