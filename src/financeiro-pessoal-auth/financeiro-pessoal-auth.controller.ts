import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { FinanceiroPessoalAuthService } from './financeiro-pessoal-auth.service';
import { PessoalTokenGuard } from './pessoal-token.guard';
import { EntrarPessoalDto } from './dto/entrar.dto';
import { CadastrarPessoalDto } from './dto/cadastrar.dto';
import { RedefinirSenhaPessoalDto } from './dto/redefinir-senha.dto';

// Único ponto de entrada da área Pessoal — não usa o login de usuário da
// Best. Limite de tentativas mais apertado que o padrão global (120/min)
// nas rotas que verificam senha, contra força bruta.
const LIMITE_SENHA = { default: { limit: 8, ttl: 5 * 60 * 1000 } };

@Controller('financeiro/pessoal')
export class FinanceiroPessoalAuthController {
  constructor(private service: FinanceiroPessoalAuthService) {}

  // A tela de entrada consulta isto pra decidir se mostra "cadastrar senha"
  // (primeiríssimo acesso) ou o formulário normal de senha.
  @Public()
  @Get('status')
  status() {
    return this.service.status();
  }

  @Public()
  @Throttle(LIMITE_SENHA)
  @Post('cadastrar')
  cadastrar(@Body() dto: CadastrarPessoalDto) {
    return this.service.cadastrar(dto.senha);
  }

  @Public()
  @Throttle(LIMITE_SENHA)
  @Post('entrar')
  entrar(@Body() dto: EntrarPessoalDto) {
    return this.service.entrar(dto.senha);
  }

  // Só chamável já logado (qualquer escopo válido) — cadastra a segunda
  // senha uma única vez. @Public() é necessário mesmo aqui: o token
  // enviado é o do financeiro-pessoal-auth (segredo próprio), não o JWT de
  // usuário da Best — sem @Public() o guard global tentaria validar esse
  // token com a estratégia errada e rejeitaria antes do PessoalTokenGuard
  // rodar. Quem de fato exige uma sessão válida aqui é o PessoalTokenGuard.
  @Public()
  @UseGuards(PessoalTokenGuard)
  @Throttle(LIMITE_SENHA)
  @Post('cadastrar-secreta')
  cadastrarSecreta(@Body() dto: CadastrarPessoalDto) {
    return this.service.cadastrarSecreta(dto.senha);
  }

  // O gatilho "disfarçado de bug" — só chamável já logado. Resposta sempre
  // no mesmo formato de erro genérico do PessoalTokenGuard quando a senha
  // não bate.
  @Public()
  @UseGuards(PessoalTokenGuard)
  @Throttle(LIMITE_SENHA)
  @Post('entrar-secreta')
  entrarSecreta(@Body() dto: EntrarPessoalDto) {
    return this.service.entrarSecreta(dto.senha);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 15 * 60 * 1000 } })
  @Post('esqueci-senha')
  esqueciSenha() {
    return this.service.esqueciSenha();
  }

  @Public()
  @Throttle(LIMITE_SENHA)
  @Post('redefinir-senha')
  redefinirSenha(@Body() dto: RedefinirSenhaPessoalDto) {
    return this.service.redefinirSenha(dto.token, dto.novaSenha);
  }
}
