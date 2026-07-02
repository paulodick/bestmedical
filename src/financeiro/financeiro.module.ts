import { Module } from '@nestjs/common';
import { DespesasService } from './despesas.service';
import { RecebiveisService } from './recebiveis.service';
import { PessoalService } from './pessoal.service';
import { DespesasController } from './despesas.controller';

@Module({
  controllers: [DespesasController],
  providers: [DespesasService, RecebiveisService, PessoalService],
})
export class FinanceiroModule {}
