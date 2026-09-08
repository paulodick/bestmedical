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
import { PessoalTokenGuard } from '../financeiro-pessoal-auth/pessoal-token.guard';
import { EscopoMinimo } from '../financeiro-pessoal-auth/escopo-minimo.decorator';
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

// Controle Financeiro Pessoal — NÃO usa o login de usuário da Best (JWT
// global): é liberado pela senha própria de financeiro-pessoal-auth,
// compartilhável com esposa/contador/etc. @Public() tira o JwtAuthGuard
// global; PessoalTokenGuard é o único gatekeeper daqui pra baixo.
//
// As rotas "reservado/*" só respondem para quem entrou com a segunda senha
// (@EscopoMinimo('reservado')) — qualquer outra tentativa recebe a mesma
// resposta genérica de sessão inválida que uma rota inexistente, nunca uma
// pista de que ela existe.
@Public()
@UseGuards(PessoalTokenGuard)
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

  @EscopoMinimo('reservado')
  @Get('reservado/resumo')
  resumoReservado() {
    return this.reservado.resumo();
  }

  @EscopoMinimo('reservado')
  @Get('reservado/fluxo-caixa')
  fluxoCaixaReservado() {
    return this.reservado.fluxoCaixa();
  }

  @EscopoMinimo('reservado')
  @Get('reservado/despesas')
  listDespesasReservado(@Query() q: PaginationDto) {
    return this.reservado.listDespesas(q);
  }

  @EscopoMinimo('reservado')
  @Post('reservado/despesas')
  createDespesaReservado(@Body() dto: CreateDespesaReservadaDto) {
    return this.reservado.createDespesa(dto);
  }

  @EscopoMinimo('reservado')
  @Put('reservado/despesas/:id')
  updateDespesaReservado(@Param('id') id: string, @Body() dto: UpdateDespesaReservadaDto) {
    return this.reservado.updateDespesa(id, dto);
  }

  @EscopoMinimo('reservado')
  @Delete('reservado/despesas/:id')
  removeDespesaReservado(@Param('id') id: string) {
    return this.reservado.removeDespesa(id);
  }

  @EscopoMinimo('reservado')
  @Get('reservado/despesas/:id/baixas')
  listarBaixasDespesaReservado(@Param('id') id: string) {
    return this.reservado.listarBaixasDespesa(id);
  }

  @EscopoMinimo('reservado')
  @Post('reservado/despesas/:id/baixas')
  registrarBaixaDespesaReservado(@Param('id') id: string, @Body() dto: CreateBaixaDto) {
    return this.reservado.registrarBaixaDespesa(id, dto);
  }

  @EscopoMinimo('reservado')
  @Delete('reservado/despesas/:id/baixas/:baixaId')
  removerBaixaDespesaReservado(
    @Param('id') id: string,
    @Param('baixaId') baixaId: string,
  ) {
    return this.reservado.removerBaixaDespesa(id, baixaId);
  }

  @EscopoMinimo('reservado')
  @Get('reservado/recebiveis')
  listRecebiveisReservado(@Query() q: PaginationDto) {
    return this.reservado.listRecebiveis(q);
  }

  @EscopoMinimo('reservado')
  @Post('reservado/recebiveis')
  createRecebivelReservado(@Body() dto: CreateRecebivelReservadoDto) {
    return this.reservado.createRecebivel(dto);
  }

  @EscopoMinimo('reservado')
  @Put('reservado/recebiveis/:id')
  updateRecebivelReservado(
    @Param('id') id: string,
    @Body() dto: UpdateRecebivelReservadoDto,
  ) {
    return this.reservado.updateRecebivel(id, dto);
  }

  @EscopoMinimo('reservado')
  @Delete('reservado/recebiveis/:id')
  removeRecebivelReservado(@Param('id') id: string) {
    return this.reservado.removeRecebivel(id);
  }

  @EscopoMinimo('reservado')
  @Get('reservado/recebiveis/:id/baixas')
  listarBaixasRecebivelReservado(@Param('id') id: string) {
    return this.reservado.listarBaixasRecebivel(id);
  }

  @EscopoMinimo('reservado')
  @Post('reservado/recebiveis/:id/baixas')
  registrarBaixaRecebivelReservado(@Param('id') id: string, @Body() dto: CreateBaixaDto) {
    return this.reservado.registrarBaixaRecebivel(id, dto);
  }

  @EscopoMinimo('reservado')
  @Delete('reservado/recebiveis/:id/baixas/:baixaId')
  removerBaixaRecebivelReservado(
    @Param('id') id: string,
    @Param('baixaId') baixaId: string,
  ) {
    return this.reservado.removerBaixaRecebivel(id, baixaId);
  }
}
