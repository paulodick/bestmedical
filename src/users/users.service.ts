import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.usuario.findUnique({ where: { email } });
  }

  // Busca por usuário de login, sem diferenciar maiúsculas/minúsculas.
  // O valor é sempre armazenado em minúsculas, então normalizamos a consulta.
  findByUsuario(usuario: string) {
    return this.prisma.usuario.findUnique({
      where: { usuario: (usuario || '').trim().toLowerCase() },
    });
  }

  findById(id: string) {
    return this.prisma.usuario.findUnique({ where: { id } });
  }

  // Atualiza apenas o hash da senha de um usuário.
  updateSenhaHash(id: string, senhaHash: string) {
    return this.prisma.usuario.update({ where: { id }, data: { senhaHash } });
  }
}
