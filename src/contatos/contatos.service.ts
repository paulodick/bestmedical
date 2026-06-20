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
