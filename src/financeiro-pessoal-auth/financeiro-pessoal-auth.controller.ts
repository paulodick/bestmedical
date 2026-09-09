import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { FinanceiroPessoalAuthService } from './financeiro-pessoal-auth.service';
import { NivelFinanceiroGuard } from './nivel-financeiro.guard';
import { NivelMinimo } from './nivel-minimo.decorator';
import { EntrarAppDto } from './dto/entrar-app.dto';
import { CadastrarEntradaDto } from './dto/cadastrar-entrada.dto';
import { EntrarPessoalDto } from './dto/entrar.dto';
import { CadastrarPessoalDto } from './dto/cadastrar.dto';
import { RecuperarDto } from './dto/recuperar.dto';

const LIMITE_SENHA = { default: { limit: 8, ttl: 5 * 60 * 1000 } };
// PIN de 6 dígitos: limite bem mais apertado (defesa contra força bruta —
// 10^6 combinações é pouco se não houver limite de tentativas).
const LIMITE_PIN = { default: { limit: 5, ttl: 30 * 60 * 1000 } };

// Toda a autenticação em cascata do app Financeiro: entrada (nível 1,
// usuário fixo "paulodick") -> pessoal (nível 2) -> secreto (nível 3,
// gatilho disfarçado no front-end) — e a recuperação por PIN único.
@Controller('financeiro')
export class FinanceiroPessoalAuthController {
  constructor(private service: FinanceiroPessoalAuthService) {}

  // ----- Nível 1: entrada do app -----

  @Public()
  @Get('status')
  status() {
    return this.service.status();
  }

  @Public()
  @Throttle(LIMITE_SENHA)
  @Post('cadastrar-entrada')
  cadastrarEntrada(@Body() dto: CadastrarEntradaDto) {
    return this.service.cadastrarEntrada(dto);
  }

  @Public()
  @Throttle(LIMITE_SENHA)
  @Post('entrar')
  entrarApp(@Body() dto: EntrarAppDto) {
    return this.service.entrarApp(dto);
  }

  // ----- Nível 2: Financeiro Pessoal -----
  // @Public() necessário mesmo autenticado: o token é validado pelo
  // NivelFinanceiroGuard (aplicado no método), não pelo JwtAuthGuard
  // global — que também aceitaria o token (mesmo segredo), mas não checa
  // nivelFinanceiro, então não bastaria sozinho.

  @Public()
  @UseGuards(NivelFinanceiroGuard)
  @Throttle(LIMITE_SENHA)
  @Post('pessoal/cadastrar')
  cadastrarPessoal(@Body() dto: CadastrarPessoalDto) {
    return this.service.cadastrarPessoal(dto.senha);
  }

  @Public()
  @UseGuards(NivelFinanceiroGuard)
  @Throttle(LIMITE_SENHA)
  @Post('pessoal/entrar')
  entrarPessoal(@Body() dto: EntrarPessoalDto) {
    return this.service.entrarPessoal(dto.senha);
  }

  // ----- Nível 3: Financeiro Top Secret -----
  // Exige nível 'pessoal' já ativo (@NivelMinimo).

  @Public()
  @UseGuards(NivelFinanceiroGuard)
  @NivelMinimo('pessoal')
  @Throttle(LIMITE_SENHA)
  @Post('pessoal/reservado/cadastrar')
  cadastrarSecreto(@Body() dto: CadastrarPessoalDto) {
    return this.service.cadastrarSecreto(dto.senha);
  }

  @Public()
  @UseGuards(NivelFinanceiroGuard)
  @NivelMinimo('pessoal')
  @Throttle(LIMITE_SENHA)
  @Post('pessoal/reservado/entrar')
  entrarSecreto(@Body() dto: EntrarPessoalDto) {
    return this.service.entrarSecreto(dto.senha);
  }

  // ----- Recuperação (PIN único) -----

  @Public()
  @Throttle(LIMITE_PIN)
  @Post('recuperar')
  recuperar(@Body() dto: RecuperarDto) {
    return this.service.recuperar(dto.pin);
  }
}
