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
import { Public } from '../auth/public.decorator';
import { NivelFinanceiroGuard } from '../financeiro-pessoal-auth/nivel-financeiro.guard';
import { NivelMinimo } from '../financeiro-pessoal-auth/nivel-minimo.decorator';
import { PessoalService } from './pessoal.service';
import { ReservadoService } from './reservado.service';
import {
  CreateDespesaPessoalDto,
  UpdateDespesaPessoalDto,
} from './dto/despesa-pessoal.dto';
import {
  CreateRecebivelPessoalDto,
  UpdateRecebivelPessoalDto,
} from './dto/recebivel-pessoal.dto';
import {
  CreateDespesaReservadaDto,
  UpdateDespesaReservadaDto,
} from './dto/despesa-reservada.dto';
import {
  CreateRecebivelReservadoDto,
  UpdateRecebivelReservadoDto,
} from './dto/recebivel-reservado.dto';
import { CreateBaixaDto } from './dto/baixa.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

// Controle Financeiro Pessoal — nível 2 da cascata do app Financeiro
// (entrada -> pessoal -> secreto). O token ainda é validado pelo
// NivelFinanceiroGuard, não pelo JwtAuthGuard global (por isso @Public() em
// tudo daqui pra baixo) — mas é o MESMO JWT de usuário da Best por baixo,
// só que com a claim nivelFinanceiro. Compartilhável com esposa/contador/
// etc. dando a eles as senhas de entrada + pessoal.
//
// @NivelMinimo('pessoal') na classe: um token só de nível 'entrada' (que
// abre apenas o Financeiro Best) NÃO deve conseguir ler/escrever aqui sem
// nunca ter passado pela senha pessoal — mesmo sendo tecnicamente um JWT
// válido do mesmo usuário admin. As rotas "reservado/*" (Financeiro Top
// Secret) sobrescrevem para @NivelMinimo('secreto') — qualquer outra
// tentativa recebe a mesma resposta genérica de sessão inválida que uma
// rota inexistente, nunca uma pista de que ela existe.
@Public()
@UseGuards(NivelFinanceiroGuard)
@NivelMinimo('pessoal')
@Controller('financeiro/pessoal')
export class PessoalController {
  constructor(
    private pessoal: PessoalService,
    private reservado: ReservadoService,
  ) {}

  // ===================== Pessoal (senha comum) =====================

  @Get('resumo')
  resumoPessoal() {
    return this.pessoal.resumo();
  }

  @Get('fluxo-caixa')
  fluxoCaixaPessoal() {
    return this.pessoal.fluxoCaixa();
  }

  @Get('despesas')
  listDespesasPessoal(@Query() q: PaginationDto) {
    return this.pessoal.listDespesas(q);
  }

  @Post('despesas')
  createDespesaPessoal(@Body() dto: CreateDespesaPessoalDto) {
    return this.pessoal.createDespesa(dto);
  }

  @Put('despesas/:id')
  updateDespesaPessoal(@Param('id') id: string, @Body() dto: UpdateDespesaPessoalDto) {
    return this.pessoal.updateDespesa(id, dto);
  }

  @Delete('despesas/:id')
  removeDespesaPessoal(@Param('id') id: string) {
    return this.pessoal.removeDespesa(id);
  }

  @Get('despesas/:id/baixas')
  listarBaixasDespesaPessoal(@Param('id') id: string) {
    return this.pessoal.listarBaixasDespesa(id);
  }

  @Post('despesas/:id/baixas')
  registrarBaixaDespesaPessoal(@Param('id') id: string, @Body() dto: CreateBaixaDto) {
    return this.pessoal.registrarBaixaDespesa(id, dto);
  }

  @Delete('despesas/:id/baixas/:baixaId')
  removerBaixaDespesaPessoal(
    @Param('id') id: string,
    @Param('baixaId') baixaId: string,
  ) {
    return this.pessoal.removerBaixaDespesa(id, baixaId);
  }

  @Get('recebiveis')
  listRecebiveisPessoal(@Query() q: PaginationDto) {
    return this.pessoal.listRecebiveis(q);
  }

  @Post('recebiveis')
  createRecebivelPessoal(@Body() dto: CreateRecebivelPessoalDto) {
    return this.pessoal.createRecebivel(dto);
  }

  @Put('recebiveis/:id')
  updateRecebivelPessoal(@Param('id') id: string, @Body() dto: UpdateRecebivelPessoalDto) {
    return this.pessoal.updateRecebivel(id, dto);
  }

  @Delete('recebiveis/:id')
  removeRecebivelPessoal(@Param('id') id: string) {
    return this.pessoal.removeRecebivel(id);
  }

  @Get('recebiveis/:id/baixas')
  listarBaixasRecebivelPessoal(@Param('id') id: string) {
    return this.pessoal.listarBaixasRecebivel(id);
  }

  @Post('recebiveis/:id/baixas')
  registrarBaixaRecebivelPessoal(@Param('id') id: string, @Body() dto: CreateBaixaDto) {
    return this.pessoal.registrarBaixaRecebivel(id, dto);
  }

  @Delete('recebiveis/:id/baixas/:baixaId')
  removerBaixaRecebivelPessoal(
    @Param('id') id: string,
    @Param('baixaId') baixaId: string,
  ) {
    return this.pessoal.removerBaixaRecebivel(id, baixaId);
  }

  // ===================== Reservado (segunda senha) =====================

  @NivelMinimo('secreto')
  @Get('reservado/resumo')
  resumoReservado() {
    return this.reservado.resumo();
  }

  @NivelMinimo('secreto')
  @Get('reservado/fluxo-caixa')
  fluxoCaixaReservado() {
    return this.reservado.fluxoCaixa();
  }

  @NivelMinimo('secreto')
  @Get('reservado/despesas')
  listDespesasReservado(@Query() q: PaginationDto) {
    return this.reservado.listDespesas(q);
  }

  @NivelMinimo('secreto')
  @Post('reservado/despesas')
  createDespesaReservado(@Body() dto: CreateDespesaReservadaDto) {
    return this.reservado.createDespesa(dto);
  }

  @NivelMinimo('secreto')
  @Put('reservado/despesas/:id')
  updateDespesaReservado(@Param('id') id: string, @Body() dto: UpdateDespesaReservadaDto) {
    return this.reservado.updateDespesa(id, dto);
  }

  @NivelMinimo('secreto')
  @Delete('reservado/despesas/:id')
  removeDespesaReservado(@Param('id') id: string) {
    return this.reservado.removeDespesa(id);
  }

  @NivelMinimo('secreto')
  @Get('reservado/despesas/:id/baixas')
  listarBaixasDespesaReservado(@Param('id') id: string) {
    return this.reservado.listarBaixasDespesa(id);
  }

  @NivelMinimo('secreto')
  @Post('reservado/despesas/:id/baixas')
  registrarBaixaDespesaReservado(@Param('id') id: string, @Body() dto: CreateBaixaDto) {
    return this.reservado.registrarBaixaDespesa(id, dto);
  }

  @NivelMinimo('secreto')
  @Delete('reservado/despesas/:id/baixas/:baixaId')
  removerBaixaDespesaReservado(
    @Param('id') id: string,
    @Param('baixaId') baixaId: string,
  ) {
    return this.reservado.removerBaixaDespesa(id, baixaId);
  }

  @NivelMinimo('secreto')
  @Get('reservado/recebiveis')
  listRecebiveisReservado(@Query() q: PaginationDto) {
    return this.reservado.listRecebiveis(q);
  }

  @NivelMinimo('secreto')
  @Post('reservado/recebiveis')
  createRecebivelReservado(@Body() dto: CreateRecebivelReservadoDto) {
    return this.reservado.createRecebivel(dto);
  }

  @NivelMinimo('secreto')
  @Put('reservado/recebiveis/:id')
  updateRecebivelReservado(
    @Param('id') id: string,
    @Body() dto: UpdateRecebivelReservadoDto,
  ) {
    return this.reservado.updateRecebivel(id, dto);
  }

  @NivelMinimo('secreto')
  @Delete('reservado/recebiveis/:id')
  removeRecebivelReservado(@Param('id') id: string) {
    return this.reservado.removeRecebivel(id);
  }

  @NivelMinimo('secreto')
  @Get('reservado/recebiveis/:id/baixas')
  listarBaixasRecebivelReservado(@Param('id') id: string) {
    return this.reservado.listarBaixasRecebivel(id);
  }

  @NivelMinimo('secreto')
  @Post('reservado/recebiveis/:id/baixas')
  registrarBaixaRecebivelReservado(@Param('id') id: string, @Body() dto: CreateBaixaDto) {
    return this.reservado.registrarBaixaRecebivel(id, dto);
  }

  @NivelMinimo('secreto')
  @Delete('reservado/recebiveis/:id/baixas/:baixaId')
  removerBaixaRecebivelReservado(
    @Param('id') id: string,
    @Param('baixaId') baixaId: string,
  ) {
    return this.reservado.removerBaixaRecebivel(id, baixaId);
  }
}
