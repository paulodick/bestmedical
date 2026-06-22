import { Module, forwardRef } from '@nestjs/common';
import { OrcamentosService } from './orcamentos.service';
import { OrcamentosController } from './orcamentos.controller';
import { PdfService } from './pdf/pdf.service';
import { OrdensServicoModule } from '../ordens-servico/ordens-servico.module';

@Module({
  // Importa OrdensServicoModule para que OrdensServicoService possa ser injetado
  // no OrcamentosService. forwardRef evita dependência circular caso os módulos
  // referenciem-se mutuamente.
  imports: [forwardRef(() => OrdensServicoModule)],
  controllers: [OrcamentosController],
  providers: [OrcamentosService, PdfService],
})
export class OrcamentosModule {}
