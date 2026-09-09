import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { NIVEL_MINIMO_KEY } from './nivel-minimo.decorator';
import { NivelFinanceiro, ORDEM_NIVEL } from './financeiro-pessoal-auth.service';

// Guard das rotas do app Financeiro que exigem um nível mínimo na cascata
// entrada < pessoal < secreto. O token é o MESMO token de usuário da Best
// (mesmo JWT_SECRET) — só carrega uma claim extra `nivelFinanceiro`. Isso é
// proposital: o mesmo token que abre este guard também satisfaz o
// JwtAuthGuard/RolesGuard das rotas /financeiro/* (Best), então uma sessão
// de nível 'entrada' já enxerga o Financeiro Best sem nenhuma rota extra.
//
// Mensagem de erro sempre genérica ("Sessão inválida.") — tanto pra token
// ausente/inválido quanto pra nível insuficiente numa rota @NivelMinimo
// mais alta. Uma sessão 'pessoal' tentando bater numa rota que exige
// 'secreto' não pode receber nada que denuncie a existência dela.
@Injectable()
export class NivelFinanceiroGuard implements CanActivate {
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

    let payload: { nivelFinanceiro?: string };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Sessão inválida.');
    }

    const nivel = payload?.nivelFinanceiro as NivelFinanceiro | undefined;
    if (!nivel || !(nivel in ORDEM_NIVEL)) {
      throw new UnauthorizedException('Sessão inválida.');
    }

    const nivelMinimo = this.reflector.getAllAndOverride<NivelFinanceiro | undefined>(
      NIVEL_MINIMO_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (nivelMinimo && ORDEM_NIVEL[nivel] < ORDEM_NIVEL[nivelMinimo]) {
      throw new UnauthorizedException('Sessão inválida.');
    }

    req.nivelFinanceiro = nivel;
    return true;
  }
}
