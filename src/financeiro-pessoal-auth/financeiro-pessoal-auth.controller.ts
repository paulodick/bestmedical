import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { FinanceiroPessoalAuthService } from './financeiro-pessoal-auth.service';
import { EntrarPessoalDto } from './dto/entrar.dto';

@Controller('financeiro/pessoal')
export class FinanceiroPessoalAuthController {
  constructor(private service: FinanceiroPessoalAuthService) {}

  // Único ponto de entrada da área Pessoal — não usa o login de usuário da
  // Best. A mesma tela/campo de senha vale tanto para a senha comum quanto
  // para a segunda senha (reservada); o front-end nunca deve diferenciar as
  // duas antes desta chamada responder.
  @Public()
  @Post('entrar')
  entrar(@Body() dto: EntrarPessoalDto) {
    return this.service.entrar(dto);
  }
}
