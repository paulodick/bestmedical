import { Module } from '@nestjs/common';
import { DespesasService } from './despesas.service';
import { RecebiveisService } from './recebiveis.service';
import { PessoalService } from './pessoal.service';
import { PaduService } from './padu.service';
import { ReservadoService } from './reservado.service';
import { DespesasController } from './despesas.controller';
import { PessoalController } from './pessoal.controller';
import { PaduController } from './padu.controller';
import { FinanceiroPessoalAuthModule } from '../financeiro-pessoal-auth/financeiro-pessoal-auth.module';

@Module({
  imports: [FinanceiroPessoalAuthModule],
  controllers: [DespesasController, PessoalController, PaduController],
  providers: [DespesasService, RecebiveisService, PessoalService, PaduService, ReservadoService],
})
export class FinanceiroModule {}
