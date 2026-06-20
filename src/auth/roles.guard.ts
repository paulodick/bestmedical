import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Perfil, ROLES_KEY } from './roles.decorator';

// Verifica se o usuário autenticado (req.user, preenchido pela JwtStrategy)
// possui um dos perfis exigidos pelo decorator @Roles.
// Deve ser usado SEMPRE em conjunto com o JwtAuthGuard, que roda antes e
// anexa o usuário ao request.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Perfil[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Sem @Roles definido => basta estar autenticado.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user?.perfil) {
      throw new ForbiddenException('Usuário sem perfil definido');
    }

    if (!requiredRoles.includes(user.perfil)) {
      throw new ForbiddenException(
        'Você não tem permissão para executar esta ação',
      );
    }
    return true;
  }
}
