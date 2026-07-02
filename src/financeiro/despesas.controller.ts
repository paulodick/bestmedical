import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DespesasService } from './despesas.service';
import { CreateDespesaDto, UpdateDespesaDto } from './dto/despesa.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';

// Controle Financeiro — módulo de Despesas + Resumo (Dashboard/Fluxo de Caixa).
// Todo o módulo é restrito ao admin (mesma regra do CRM/Financeiro).
@UseGuards(JwtAuthGuard)
@Controller('financeiro')
export class DespesasController {
  constructor(private despesas: DespesasService) {}

  // Resumo consolidado: KPIs + fluxo de caixa mensal + despesas por categoria.
  @Roles('admin')
  @Get('resumo')
  resumo() {
    return this.despesas.resumo();
  }

  @Roles('admin')
  @Get('despesas')
  list(@Query() q: PaginationDto) {
    return this.despesas.list(q);
  }

  @Roles('admin')
  @Post('despesas')
  create(@Body() dto: CreateDespesaDto) {
    return this.despesas.create(dto);
  }

  @Roles('admin')
  @Put('despesas/:id')
  update(@Param('id') id: string, @Body() dto: UpdateDespesaDto) {
    return this.despesas.update(id, dto);
  }

  @Roles('admin')
  @Delete('despesas/:id')
  remove(@Param('id') id: string) {
    return this.despesas.remove(id);
  }
}
