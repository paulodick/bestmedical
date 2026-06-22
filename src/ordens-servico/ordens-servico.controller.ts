import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { OrdensServicoService } from './ordens-servico.service';
import { OsPdfService } from './pdf/os-pdf.service';
import { UpdateOrdemServicoDto, EnviarOsDto } from './dto/ordem-servico.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';

// JwtAuthGuard já é global; manter aqui é redundante mas explícito.
@UseGuards(JwtAuthGuard)
@Controller('ordens-servico')
export class OrdensServicoController {
  constructor(
    private ordensServico: OrdensServicoService,
    private pdf: OsPdfService,
  ) {}

  // Lista todas as OS (opcional)
  @Get()
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.ordensServico.list(
      parseInt(page || '1', 10),
      parseInt(pageSize || '50', 10),
    );
  }

  // Busca a OS pelo id do orçamento — deve vir ANTES de :id para não colidir
  @Get('por-orcamento/:orcamentoId')
  getPorOrcamento(@Param('orcamentoId') orcamentoId: string) {
    return this.ordensServico.getPorOrcamento(orcamentoId);
  }

  // Busca a OS pelo id próprio
  @Get(':id')
  get(@Param('id') id: string) {
    return this.ordensServico.get(id);
  }

  // Gera e serve o PDF da OS
  @Get(':id/pdf')
  async pdfDownload(@Param('id') id: string, @Res() res: Response) {
    const os = await this.ordensServico.get(id);
    const buffer = await this.pdf.gerar(os);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${os.numero || 'ordem-servico'}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  // Atualiza os campos editáveis (itens, fotos, assinaturas, textos)
  @Roles('admin', 'operador')
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOrdemServicoDto,
  ) {
    return this.ordensServico.update(id, dto);
  }

  // Envia a OS por e-mail para múltiplos destinatários
  @Roles('admin', 'operador')
  @Post(':id/enviar')
  enviar(@Param('id') id: string, @Body() dto: EnviarOsDto) {
    return this.ordensServico.enviar(id, dto.destinatarios);
  }
}
