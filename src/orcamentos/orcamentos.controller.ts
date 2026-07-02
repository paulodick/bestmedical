import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { OrcamentosService } from './orcamentos.service';
import { PdfService } from './pdf/pdf.service';
import { CreateOrcamentoDto, UpdateOrcamentoDto } from './dto/orcamento.dto';
import {
  ListarOrcamentosDto,
  UpdateStatusDto,
} from './dto/listar-orcamentos.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

// O JwtAuthGuard já é global; manter aqui é redundante mas inofensivo e explícito.
@UseGuards(JwtAuthGuard)
@Controller('orcamentos')
export class OrcamentosController {
  constructor(
    private orcamentos: OrcamentosService,
    private pdf: PdfService,
  ) {}

  // Próximo número sugerido — vem antes de :id para não colidir
  @Get('proximo-numero')
  async proximoNumero() {
    return { numero: await this.orcamentos.proximoNumero() };
  }

  // Buscar um orçamento pelo número exato (ex.: ORC-2026-0001).
  // Usado pela tela de Novo Orçamento ao digitar o número (Enter/blur).
  // Vem antes de :id para não colidir com a rota de detalhe por id.
  @Get('por-numero/:numero')
  buscarPorNumero(@Param('numero') numero: string) {
    return this.orcamentos.buscarPorNumero(numero);
  }

  @Get()
  list(@Query() q: ListarOrcamentosDto) {
    return this.orcamentos.list(q);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.orcamentos.get(id);
  }

  // Gera e baixa o PDF do orçamento
  @Get(':id/pdf')
  async pdfDownload(@Param('id') id: string, @Res() res: Response) {
    const orc = await this.orcamentos.get(id);
    const buffer = await this.pdf.gerar(orc);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${orc.numero || 'orcamento'}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Roles('admin', 'operador')
  @Post()
  create(@Body() dto: CreateOrcamentoDto, @CurrentUser() user: AuthUser) {
    return this.orcamentos.create(dto, user?.id);
  }

  @Roles('admin', 'operador')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOrcamentoDto) {
    return this.orcamentos.update(id, dto);
  }

  @Roles('admin', 'operador')
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.orcamentos.updateStatus(id, dto);
  }

  @Roles('admin', 'operador')
  @Post(':id/enviar')
  enviar(@Param('id') id: string) {
    return this.orcamentos.enviar(id);
  }

  // Exclusão é uma ação destrutiva — restrita ao administrador master
  // (usuário 'paulodick'). A checagem fina fica no service.
  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.orcamentos.remove(id, user);
  }
}
