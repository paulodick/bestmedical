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
import { ContratosService } from './contratos.service';
import { PropostaPdfService } from './pdf/proposta-pdf.service';
import { CreatePropostaDto, UpdatePropostaDto } from './dto/proposta.dto';
import {
  ListarPropostasDto,
  UpdateStatusPropostaDto,
} from './dto/listar-propostas.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

// O JwtAuthGuard já é global; manter aqui é redundante mas inofensivo e explícito.
@UseGuards(JwtAuthGuard)
@Controller('propostas')
export class ContratosController {
  constructor(
    private contratos: ContratosService,
    private pdf: PropostaPdfService,
  ) {}

  // Próximo número sugerido — vem antes de :id para não colidir
  @Get('proximo-numero')
  async proximoNumero() {
    return { numero: await this.contratos.proximoNumero() };
  }

  // Buscar uma proposta pelo número exato (ex.: PC-2026-0001).
  // Usado pela tela de Proposta de Contrato ao digitar o número (Enter/blur).
  // Vem antes de :id para não colidir com a rota de detalhe por id.
  @Get('por-numero/:numero')
  buscarPorNumero(@Param('numero') numero: string) {
    return this.contratos.buscarPorNumero(numero);
  }

  @Get()
  list(@Query() q: ListarPropostasDto) {
    return this.contratos.list(q);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.contratos.get(id);
  }

  // Gera e baixa o PDF da proposta
  @Get(':id/pdf')
  async pdfDownload(@Param('id') id: string, @Res() res: Response) {
    const prop = await this.contratos.get(id);
    const buffer = await this.pdf.gerar(prop);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${prop.numero || 'proposta'}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Roles('admin', 'operador')
  @Post()
  create(@Body() dto: CreatePropostaDto, @CurrentUser() user: AuthUser) {
    return this.contratos.create(dto, user?.id);
  }

  @Roles('admin', 'operador')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePropostaDto) {
    return this.contratos.update(id, dto);
  }

  @Roles('admin', 'operador')
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusPropostaDto) {
    return this.contratos.updateStatus(id, dto);
  }

  @Roles('admin', 'operador')
  @Post(':id/enviar')
  enviar(@Param('id') id: string) {
    return this.contratos.enviar(id);
  }

  // Exclusão é uma ação destrutiva — restrita a administradores.
  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contratos.remove(id);
  }
}
