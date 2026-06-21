import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClienteDto, UpdateClienteDto } from './dto/cliente.dto';
import { PaginationDto, Paginated } from '../common/dto/pagination.dto';
import { Cliente, Prisma } from '@prisma/client';

@Injectable()
export class ClientesService {
  constructor(private prisma: PrismaService) {}

  async list(q: PaginationDto): Promise<Paginated<Cliente>> {
    const where: Prisma.ClienteWhereInput = q.busca
      ? {
          OR: [
            { nome: { contains: q.busca, mode: 'insensitive' } },
            { cnpj: { contains: q.busca, mode: 'insensitive' } },
            { cidade: { contains: q.busca, mode: 'insensitive' } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.cliente.findMany({
        where,
        orderBy: { nome: 'asc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.cliente.count({ where }),
    ]);

    return {
      data,
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.ceil(total / q.pageSize) || 1,
    };
  }

  // ===== Autocompletar por CNPJ =====
  // Usado na tela de Novo Orçamento: ao digitar o CNPJ, devolve os dados
  // cadastrais da empresa (endereço, número, complemento etc.) e os dados do
  // último solicitante usado, para preencher o formulário automaticamente.
  // Retorna null (200) quando o CNPJ ainda não existe — assim o front trata
  // como “novo cliente” sem precisar lidar com erro 404.
  async buscarPorCnpj(cnpjBruto: string) {
    const cnpj = (cnpjBruto || '').trim();
    if (!cnpj) return null;

    const cliente = await this.prisma.cliente.findUnique({
      where: { cnpj },
      include: {
        // contato mais recente para sugerir solicitante/setor/contato
        contatos: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!cliente) return null;

    const contato = cliente.contatos[0];
    return {
      encontrado: true,
      cnpj: cliente.cnpj ?? '',
      empresa: cliente.nome ?? '',
      cep: cliente.cep ?? '',
      endereco: cliente.endereco ?? '',
      enderecoNumero: cliente.numero ?? '',
      complemento: cliente.complemento ?? '',
      bairro: cliente.bairro ?? '',
      cidade: cliente.cidade ?? '',
      estado: cliente.estado ?? '',
      pais: cliente.pais ?? 'Brasil',
      // dados do último solicitante (editáveis no front)
      solicitante: contato?.nome ?? '',
      setor: contato?.setor ?? '',
      telefone: contato?.telefone ?? '',
      email: contato?.email ?? '',
    };
  }

  async get(id: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id },
      include: { contatos: true },
    });
    if (!cliente) throw new NotFoundException('Cliente não encontrado');
    return cliente;
  }

  create(dto: CreateClienteDto) {
    return this.prisma.cliente.create({ data: dto });
  }

  async update(id: string, dto: UpdateClienteDto) {
    await this.get(id);
    return this.prisma.cliente.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.get(id);
    await this.prisma.cliente.delete({ where: { id } });
    return { ok: true };
  }
}
