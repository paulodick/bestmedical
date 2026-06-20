import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

// Resposta normalizada (espelha os campos de endereço do front)
export interface EnderecoCep {
  cep: string;
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
}

@Injectable()
export class CepService {
  async consultar(cepRaw: string): Promise<EnderecoCep> {
    const cep = (cepRaw || '').replace(/\D/g, '');
    if (cep.length !== 8) {
      throw new BadRequestException('CEP inválido (use 8 dígitos)');
    }

    // ViaCEP — API pública gratuita
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!res.ok) {
      throw new NotFoundException('Não foi possível consultar o CEP');
    }
    const data: any = await res.json();
    if (data.erro) {
      throw new NotFoundException('CEP não encontrado');
    }

    return {
      cep: data.cep,
      endereco: data.logradouro || '',
      bairro: data.bairro || '',
      cidade: data.localidade || '',
      estado: data.uf || '',
    };
  }
}
