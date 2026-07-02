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
import { RecebiveisService } from './recebiveis.service';
import { PessoalService } from './pessoal.service';
import { CreateDespesaDto, UpdateDespesaDto } from './dto/despesa.dto';
import {
  CreateRecebivelDto,
  UpdateRecebivelDto,
} from './dto/recebivel.dto';
import {
  CreateLancamentoPessoalDto,
  UpdateLancamentoPessoalDto,
} from './dto/lancamento-pessoal.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';

// Controle Financeiro — módulo de Despesas + Resumo (Dashboard/Fluxo de Caixa).
// Todo o módulo é restrito ao admin (mesma regra do CRM/Financeiro).
@UseGuards(JwtAuthGuard)
@Controller('financeiro')
export class DespesasController {
  constructor(
    private despesas: DespesasService,
    private recebiveis: RecebiveisService,
    private pessoal: PessoalService,
  ) {}

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

  // ===== Recebíveis avulsos (manuais) =====
  @Roles('admin')
  @Get('recebiveis')
  listRecebiveis(@Query() q: PaginationDto) {
    return this.recebiveis.list(q);
  }

  @Roles('admin')
  @Post('recebiveis')
  createRecebivel(@Body() dto: CreateRecebivelDto) {
    return this.recebiveis.create(dto);
  }

  @Roles('admin')
  @Put('recebiveis/:id')
  updateRecebivel(@Param('id') id: string, @Body() dto: UpdateRecebivelDto) {
    return this.recebiveis.update(id, dto);
  }

  @Roles('admin')
  @Delete('recebiveis/:id')
  removeRecebivel(@Param('id') id: string) {
    return this.recebiveis.remove(id);
  }

  // ===== Controle Financeiro Pessoal (exclusivo admin master) =====
  @Roles('admin')
  @Get('pessoal/resumo')
  resumoPessoal() {
    return this.pessoal.resumo();
  }

  @Roles('admin')
  @Get('pessoal')
  listPessoal(@Query() q: PaginationDto) {
    return this.pessoal.list(q);
  }

  @Roles('admin')
  @Post('pessoal')
  createPessoal(@Body() dto: CreateLancamentoPessoalDto) {
    return this.pessoal.create(dto);
  }

  @Roles('admin')
  @Put('pessoal/:id')
  updatePessoal(
    @Param('id') id: string,
    @Body() dto: UpdateLancamentoPessoalDto,
  ) {
    return this.pessoal.update(id, dto);
  }

  @Roles('admin')
  @Delete('pessoal/:id')
  removePessoal(@Param('id') id: string) {
    return this.pessoal.remove(id);
  }
}
