import { SetMetadata } from '@nestjs/common';

// Perfis válidos no sistema (espelham o enum Prisma "Perfil")
export type Perfil = 'admin' | 'operador' | 'visualizador';

export const ROLES_KEY = 'roles';

// Uso: @Roles('admin', 'operador') em um método ou controller.
// Sem o decorator, qualquer usuário autenticado tem acesso (apenas o JwtAuthGuard).
export const Roles = (...roles: Perfil[]) => SetMetadata(ROLES_KEY, roles);
