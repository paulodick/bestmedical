import { Body, Controller, Get, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AlterarSenhaDto } from './dto/alterar-senha.dto';
import { Public } from './public.decorator';
import { CurrentUser, AuthUser } from './current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  // Login é público, mas com limite estrito contra força bruta:
  // no máximo 5 tentativas por minuto por IP.
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  // Troca de senha a partir da tela de login (público), exigindo senha atual.
  // Limite estrito para evitar abuso/força bruta.
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('alterar-senha')
  alterarSenha(@Body() dto: AlterarSenhaDto) {
    return this.auth.alterarSenha(dto);
  }

  // Protegido pelo JwtAuthGuard global. Usado pelo front para reidratar a sessão.
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
