import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ESCOPO_MINIMO_PESSOAL_KEY } from './escopo-minimo.decorator';
import { EscopoPessoal } from './financeiro-pessoal-auth.service';

// Guard próprio das rotas /financeiro/pessoal/* — NÃO usa o JwtAuthGuard
// global (essas rotas são @Public(), pois esposa/contador não têm login de
// usuário da Best). Valida o token emitido por FinanceiroPessoalAuthService
// (segredo e formato próprios, sem relação com o JWT de login da empresa).
//
// Importante: a mensagem de erro é SEMPRE a mesma ("Sessão inválida."),
// tanto para "sem token"/"token inválido" quanto para "token válido mas
// escopo insuficiente" — uma sessão comum (escopo 'pessoal') tentando bater
// numa rota @EscopoMinimo('reservado') não pode receber uma resposta que
// denuncie a existência dessa rota.
@Injectable()
export class PessoalTokenGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const auth: string | undefined = req.headers['authorization'];
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) {
      throw new UnauthorizedException('Sessão inválida.');
    }

    let payload: { escopo?: string };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Sessão inválida.');
    }

    if (payload?.escopo !== 'pessoal' && payload?.escopo !== 'reservado') {
      throw new UnauthorizedException('Sessão inválida.');
    }

    const escopoMinimo = this.reflector.getAllAndOverride<EscopoPessoal | undefined>(
      ESCOPO_MINIMO_PESSOAL_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (escopoMinimo === 'reservado' && payload.escopo !== 'reservado') {
      throw new UnauthorizedException('Sessão inválida.');
    }

    req.escopoPessoal = payload.escopo as EscopoPessoal;
    return true;
  }
}
