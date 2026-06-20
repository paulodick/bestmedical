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
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

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

  @Post()
  create(@Body() dto: CreateOrcamentoDto, @CurrentUser() user: AuthUser) {
    return this.orcamentos.create(dto, user?.id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOrcamentoDto) {
    return this.orcamentos.update(id, dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.orcamentos.updateStatus(id, dto);
  }

  @Post(':id/enviar')
  enviar(@Param('id') id: string) {
    return this.orcamentos.enviar(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.orcamentos.remove(id);
  }
}
