import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { EntrarPessoalDto } from './dto/entrar.dto';

// 'pessoal' = senha comum (compartilhada com esposa/contador/etc.).
// 'reservado' = segunda senha, dá acesso também à área reservada — por
// design, do lado de fora (tela de login, mensagens de erro, tempo de
// resposta) as duas senhas devem ser indistinguíveis de uma senha errada.
export type EscopoPessoal = 'pessoal' | 'reservado';

@Injectable()
export class FinanceiroPessoalAuthService {
  constructor(private jwt: JwtService) {}

  async entrar(dto: EntrarPessoalDto): Promise<{ accessToken: string }> {
    const hashPessoal = process.env.SENHA_PESSOAL_HASH || '';
    const hashReservado = process.env.SENHA_RESERVADO_HASH || '';

    // Sempre compara contra os dois hashes (mesmo se um já tiver batido),
    // para não criar uma diferença de tempo perceptível entre "acertou a
    // senha comum", "acertou a reservada" e "errou tudo".
    const [okPessoal, okReservado] = await Promise.all([
      hashPessoal ? bcrypt.compare(dto.senha, hashPessoal) : Promise.resolve(false),
      hashReservado ? bcrypt.compare(dto.senha, hashReservado) : Promise.resolve(false),
    ]);

    const escopo: EscopoPessoal | null = okReservado
      ? 'reservado'
      : okPessoal
        ? 'pessoal'
        : null;

    if (!escopo) {
      throw new UnauthorizedException('Senha incorreta.');
    }

    const accessToken = await this.jwt.signAsync({ escopo });
    return { accessToken };
  }
}
