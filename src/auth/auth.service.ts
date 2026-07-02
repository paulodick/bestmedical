import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { AlterarSenhaDto } from './dto/alterar-senha.dto';

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    // Login por usuário, sem diferenciar maiúsculas/minúsculas.
    const user = await this.users.findByUsuario(dto.usuario);
    if (!user || !user.ativo) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    const ok = await bcrypt.compare(dto.senha, user.senhaHash);
    if (!ok) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const payload = {
      sub: user.id,
      usuario: user.usuario,
      email: user.email,
      perfil: user.perfil,
    };
    const accessToken = await this.jwt.signAsync(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        nome: user.nome,
        usuario: user.usuario,
        email: user.email,
        perfil: user.perfil,
      },
    };
  }

  // Troca de senha a partir da tela de login (sem sessão ativa).
  // Exige usuário + senha atual corretos. Não revela se o usuário existe.
  async alterarSenha(dto: AlterarSenhaDto) {
    const user = await this.users.findByUsuario(dto.usuario);
    const ok =
      !!user &&
      user.ativo &&
      (await bcrypt.compare(dto.senhaAtual, user.senhaHash));
    if (!ok) {
      throw new UnauthorizedException('Usuário ou senha atual inválidos.');
    }
    if (dto.novaSenha === dto.senhaAtual) {
      throw new BadRequestException(
        'A nova senha deve ser diferente da atual.',
      );
    }
    const novoHash = await bcrypt.hash(dto.novaSenha, 10);
    await this.users.updateSenhaHash(user.id, novoHash);
    return { ok: true };
  }

  // Utilitário para gerar hash (usado no seed)
  static async hash(senha: string): Promise<string> {
    return bcrypt.hash(senha, 10);
  }
}
