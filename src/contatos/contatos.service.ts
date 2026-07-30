import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContatoDto, UpdateContatoDto } from './dto/contato.dto';

@Injectable()
export class ContatosService {
  constructor(private prisma: PrismaService) {}

  async listByCliente(clienteId: string) {
    await this.ensureCliente(clienteId);
    return this.prisma.contato.findMany({
      where: { clienteId },
      orderBy: { nome: 'asc' },
    });
  }

  async create(clienteId: string, dto: CreateContatoDto) {
    await this.ensureCliente(clienteId);

    // Evita duplicar o mesmo solicitante para o cliente (ex.: clique duplo
    // em "Salvar solicitante"). Se já existir um contato com o mesmo nome
    // (comparação sem acento/case) para este cliente, atualiza os dados em
    // vez de criar um novo registro.
    const nomeNovo = (dto.nome || '').trim();
    const existentes = await this.prisma.contato.findMany({
      where: { clienteId },
    });
    const normaliza = (v: string) =>
      v
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    const duplicado = existentes.find(
      (c) => normaliza(c.nome) === normaliza(nomeNovo),
    );
    if (duplicado) {
      return this.prisma.contato.update({
        where: { id: duplicado.id },
        data: { ...dto },
      });
    }

    return this.prisma.contato.create({ data: { ...dto, clienteId } });
  }

  async update(id: string, dto: UpdateContatoDto) {
    await this.ensureContato(id);
    return this.prisma.contato.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.ensureContato(id);
    await this.prisma.contato.delete({ where: { id } });
    return { ok: true };
  }

  private async ensureCliente(id: string) {
    const c = await this.prisma.cliente.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Cliente não encontrado');
  }

  private async ensureContato(id: string) {
    const c = await this.prisma.contato.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Contato não encontrado');
  }
}
