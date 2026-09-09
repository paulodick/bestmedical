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
import { PaduService } from './padu.service';
import { CreateDespesaPaduDto, UpdateDespesaPaduDto } from './dto/despesa-padu.dto';
import { CreateRecebivelPaduDto, UpdateRecebivelPaduDto } from './dto/recebivel-padu.dto';
import { CreateBaixaDto } from './dto/baixa.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';

// Controle Financeiro da Padu Studios — usa o mesmo login de usuário da
// Best (JWT + admin), igual ao CRM: a exclusividade para o usuário
// 'paulodick' é aplicada no front-end (navegação), não aqui.
@UseGuards(JwtAuthGuard)
@Controller('financeiro/padu')
export class PaduController {
  constructor(private padu: PaduService) {}

  @Roles('admin')
  @Get('resumo')
  resumo() {
    return this.padu.resumo();
  }

  @Roles('admin')
  @Get('fluxo-caixa')
  fluxoCaixa() {
    return this.padu.fluxoCaixa();
  }

  @Roles('admin')
  @Get('despesas')
  listDespesas(@Query() q: PaginationDto) {
    return this.padu.listDespesas(q);
  }

  @Roles('admin')
  @Post('despesas')
  createDespesa(@Body() dto: CreateDespesaPaduDto) {
    return this.padu.createDespesa(dto);
  }

  @Roles('admin')
  @Put('despesas/:id')
  updateDespesa(@Param('id') id: string, @Body() dto: UpdateDespesaPaduDto) {
    return this.padu.updateDespesa(id, dto);
  }

  @Roles('admin')
  @Delete('despesas/:id')
  removeDespesa(@Param('id') id: string) {
    return this.padu.removeDespesa(id);
  }

  @Roles('admin')
  @Get('despesas/:id/baixas')
  listarBaixasDespesa(@Param('id') id: string) {
    return this.padu.listarBaixasDespesa(id);
  }

  @Roles('admin')
  @Post('despesas/:id/baixas')
  registrarBaixaDespesa(@Param('id') id: string, @Body() dto: CreateBaixaDto) {
    return this.padu.registrarBaixaDespesa(id, dto);
  }

  @Roles('admin')
  @Delete('despesas/:id/baixas/:baixaId')
  removerBaixaDespesa(@Param('id') id: string, @Param('baixaId') baixaId: string) {
    return this.padu.removerBaixaDespesa(id, baixaId);
  }

  @Roles('admin')
  @Get('recebiveis')
  listRecebiveis(@Query() q: PaginationDto) {
    return this.padu.listRecebiveis(q);
  }

  @Roles('admin')
  @Post('recebiveis')
  createRecebivel(@Body() dto: CreateRecebivelPaduDto) {
    return this.padu.createRecebivel(dto);
  }

  @Roles('admin')
  @Put('recebiveis/:id')
  updateRecebivel(@Param('id') id: string, @Body() dto: UpdateRecebivelPaduDto) {
    return this.padu.updateRecebivel(id, dto);
  }

  @Roles('admin')
  @Delete('recebiveis/:id')
  removeRecebivel(@Param('id') id: string) {
    return this.padu.removeRecebivel(id);
  }

  @Roles('admin')
  @Get('recebiveis/:id/baixas')
  listarBaixasRecebivel(@Param('id') id: string) {
    return this.padu.listarBaixasRecebivel(id);
  }

  @Roles('admin')
  @Post('recebiveis/:id/baixas')
  registrarBaixaRecebivel(@Param('id') id: string, @Body() dto: CreateBaixaDto) {
    return this.padu.registrarBaixaRecebivel(id, dto);
  }

  @Roles('admin')
  @Delete('recebiveis/:id/baixas/:baixaId')
  removerBaixaRecebivel(@Param('id') id: string, @Param('baixaId') baixaId: string) {
    return this.padu.removerBaixaRecebivel(id, baixaId);
  }
}
