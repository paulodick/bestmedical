import { SetMetadata } from '@nestjs/common';
import type { NivelFinanceiro } from './financeiro-pessoal-auth.service';

export const NIVEL_MINIMO_KEY = 'nivelMinimoFinanceiro';

// Uso: @NivelMinimo('pessoal') numa rota que exige pelo menos esse nível.
// Ordem: entrada < pessoal < secreto (cada nível de cima também vale pros
// de baixo). Sem o decorator, qualquer nível autenticado (>= 'entrada') passa.
export const NivelMinimo = (nivel: NivelFinanceiro) => SetMetadata(NIVEL_MINIMO_KEY, nivel);
