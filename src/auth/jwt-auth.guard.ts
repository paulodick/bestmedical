import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Guard padrão de autenticação JWT. Aplicar nos controllers protegidos.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
