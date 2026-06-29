import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ContratoService } from './contrato.service';
import { UpdateContratoDto } from './dto/contrato.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';

// O JwtAuthGuard já é global; manter aqui é redundante mas inofensivo e explícito.
@UseGuards(JwtAuthGuard)
@Controller('contratos')
export class ContratoController {
  constructor(private contrato: ContratoService) {}

  // Gera (ou retorna, se já existir) o contrato de uma proposta.
  @Roles('admin', 'operador')
  @Post('gerar-de-proposta/:propostaId')
  gerarDeProposta(@Param('propostaId') propostaId: string) {
    return this.contrato.gerarDeProposta(propostaId);
  }

  // Busca o contrato pela proposta de origem (vem antes de :id para não colidir).
  @Get('por-proposta/:propostaId')
  getPorProposta(@Param('propostaId') propostaId: string) {
    return this.contrato.getPorProposta(propostaId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.contrato.get(id);
  }

  // Gera e baixa o PDF do contrato.
  @Get(':id/pdf')
  async pdfDownload(@Param('id') id: string, @Res() res: Response) {
    const { numero, buffer } = await this.contrato.gerarPdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${numero || 'contrato'}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Roles('admin', 'operador')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateContratoDto) {
    return this.contrato.update(id, dto);
  }

  @Roles('admin', 'operador')
  @Post(':id/enviar')
  enviar(@Param('id') id: string) {
    return this.contrato.enviar(id);
  }
}
