import { SetMetadata } from '@nestjs/common';

// Marca uma rota como pública (ignora o JwtAuthGuard global).
// Uso: @Public() acima do método (ex.: login, health).
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
