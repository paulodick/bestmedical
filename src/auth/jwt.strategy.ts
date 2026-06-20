import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';

export interface JwtPayload {
  sub: string;
  email: string;
  perfil: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private users: UsersService) {
    const secret = process.env.JWT_SECRET;
    // Em produção, um segredo ausente é um erro crítico de configuração:
    // não permitimos cair no fallback inseguro 'dev-secret'.
    if (!secret && process.env.NODE_ENV === 'production') {
      throw new Error(
        'JWT_SECRET não definido em produção. Configure a variável de ambiente.',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret || 'dev-secret',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.users.findById(payload.sub);
    if (!user || !user.ativo) {
      throw new UnauthorizedException('Usuário inválido ou inativo');
    }
    // Anexado em req.user
    return { id: user.id, email: user.email, perfil: user.perfil, nome: user.nome };
  }
}
