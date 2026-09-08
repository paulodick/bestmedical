import { SetMetadata } from '@nestjs/common';
import { EscopoPessoal } from './financeiro-pessoal-auth.service';

export const ESCOPO_MINIMO_PESSOAL_KEY = 'escopoMinimoPessoal';

// Uso: @EscopoMinimo('reservado') em uma rota que só a segunda senha destrava.
// Sem o decorator, qualquer sessão válida (pessoal OU reservado) passa.
export const EscopoMinimo = (escopo: EscopoPessoal) =>
  SetMetadata(ESCOPO_MINIMO_PESSOAL_KEY, escopo);
