import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { DespesasService } from './despesas.service';
import { RecebiveisService } from './recebiveis.service';
import {
  CreateDespesaDto,
  UpdateDespesaDto,
  UploadBoletoDespesaDto,
} from './dto/despesa.dto';
import {
  CreateRecebivelDto,
  UpdateRecebivelDto,
} from './dto/recebivel.dto';
import { CreateBaixaDto } from './dto/baixa.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';

// Controle Financeiro (Best Medical) — módulo de Despesas + Recebíveis +
// Resumo (Dashboard/Fluxo de Caixa). Restrito ao admin (login de usuário da
// Best). O Controle Financeiro Pessoal (senha própria, compartilhável) mora
// em pessoal.controller.ts — não usa este guard nem este controller.
@UseGuards(JwtAuthGuard)
@Controller('financeiro')
export class DespesasController {
  constructor(
    private despesas: DespesasService,
    private recebiveis: RecebiveisService,
  ) {}

  // Resumo consolidado: KPIs + fluxo de caixa mensal + despesas por
  // categoria + contas a pagar/receber + inadimplência + atividade recente.
  @Roles('admin')
  @Get('resumo')
  resumo() {
    return this.despesas.resumo();
  }

  // Lista plana de lançamentos individuais (entradas e saídas já
  // realizadas), usada pela página Fluxo de Caixa em formato de planilha.
  @Roles('admin')
  @Get('fluxo-caixa')
  fluxoCaixa() {
    return this.despesas.fluxoCaixa();
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

  // ===== Baixas (pagamento total ou parcial, com histórico) =====
  @Roles('admin')
  @Get('despesas/:id/baixas')
  listarBaixasDespesa(@Param('id') id: string) {
    return this.despesas.listarBaixas(id);
  }

  @Roles('admin')
  @Post('despesas/:id/baixas')
  registrarBaixaDespesa(@Param('id') id: string, @Body() dto: CreateBaixaDto) {
    return this.despesas.registrarBaixa(id, dto);
  }

  @Roles('admin')
  @Delete('despesas/:id/baixas/:baixaId')
  removerBaixaDespesa(
    @Param('id') id: string,
    @Param('baixaId') baixaId: string,
  ) {
    return this.despesas.removerBaixa(id, baixaId);
  }

  // ===== Boleto (upload/download) =====
  @Roles('admin')
  @Post('despesas/:id/boleto')
  uploadBoleto(@Param('id') id: string, @Body() dto: UploadBoletoDespesaDto) {
    return this.despesas.uploadBoleto(id, dto);
  }

  @Roles('admin')
  @Get('despesas/:id/boleto')
  async boletoDownload(@Param('id') id: string, @Res() res: Response) {
    const { buffer, nome } = await this.despesas.getBoleto(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nome}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
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

  @Roles('admin')
  @Get('recebiveis/:id/baixas')
  listarBaixasRecebivel(@Param('id') id: string) {
    return this.recebiveis.listarBaixas(id);
  }

  @Roles('admin')
  @Post('recebiveis/:id/baixas')
  registrarBaixaRecebivel(@Param('id') id: string, @Body() dto: CreateBaixaDto) {
    return this.recebiveis.registrarBaixa(id, dto);
  }

  @Roles('admin')
  @Delete('recebiveis/:id/baixas/:baixaId')
  removerBaixaRecebivel(
    @Param('id') id: string,
    @Param('baixaId') baixaId: string,
  ) {
    return this.recebiveis.removerBaixa(id, baixaId);
  }
}
