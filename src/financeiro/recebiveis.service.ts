import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateRecebivelDto,
  UpdateRecebivelDto,
} from './dto/recebivel.dto';
import { PaginationDto, Paginated } from '../common/dto/pagination.dto';
import {
  reaisParaCentavos,
  centavosParaReais,
} from '../orcamentos/orcamento.calc';
import { Prisma } from '@prisma/client';

// Formato do recebível avulso exposto ao frontend (valor em reais, datas ISO).
export interface RecebivelApi {
  id: string;
  data: string;
  empresa: string;
  cnpj: string | null;
  descricao: string | null;
  valor: number;
  pago: boolean;
  dataPagamento: string | null;
  observacoes: string | null;
}

function isoParaData(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function dataParaIso(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class RecebiveisService {
  constructor(private prisma: PrismaService) {}

  private toApi(r: {
    id: string;
    data: Date;
    empresa: string;
    cnpj: string | null;
    descricao: string | null;
    valorCentavos: number;
    pago: boolean;
    dataPagamento: Date | null;
    observacoes: string | null;
  }): RecebivelApi {
    return {
      id: r.id,
      data: dataParaIso(r.data) as string,
      empresa: r.empresa,
      cnpj: r.cnpj,
      descricao: r.descricao,
      valor: centavosParaReais(r.valorCentavos),
      pago: r.pago,
      dataPagamento: dataParaIso(r.dataPagamento),
      observacoes: r.observacoes,
    };
  }

  async list(q: PaginationDto): Promise<Paginated<RecebivelApi>> {
    const where: Prisma.RecebivelWhereInput = q.busca
      ? {
          OR: [
            { empresa: { contains: q.busca, mode: 'insensitive' } },
            { cnpj: { contains: q.busca, mode: 'insensitive' } },
            { descricao: { contains: q.busca, mode: 'insensitive' } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.recebivel.findMany({
        where,
        orderBy: [{ data: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.recebivel.count({ where }),
    ]);

    return {
      data: data.map((r) => this.toApi(r)),
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.ceil(total / q.pageSize) || 1,
    };
  }

  async create(dto: CreateRecebivelDto): Promise<RecebivelApi> {
    const r = await this.prisma.recebivel.create({
      data: {
        data: isoParaData(dto.data),
        empresa: dto.empresa,
        cnpj: dto.cnpj ?? null,
        descricao: dto.descricao ?? null,
        valorCentavos: reaisParaCentavos(dto.valor),
        pago: dto.pago ?? false,
        dataPagamento: dto.dataPagamento ? isoParaData(dto.dataPagamento) : null,
        observacoes: dto.observacoes ?? null,
      },
    });
    return this.toApi(r);
  }

  async update(id: string, dto: UpdateRecebivelDto): Promise<RecebivelApi> {
    await this.ensure(id);

    const data: Prisma.RecebivelUpdateInput = {};
    if (dto.data !== undefined) data.data = isoParaData(dto.data);
    if (dto.empresa !== undefined) data.empresa = dto.empresa;
    if (dto.cnpj !== undefined) data.cnpj = dto.cnpj ?? null;
    if (dto.descricao !== undefined) data.descricao = dto.descricao ?? null;
    if (dto.valor !== undefined)
      data.valorCentavos = reaisParaCentavos(dto.valor);
    if (dto.pago !== undefined) data.pago = dto.pago;
    if (dto.dataPagamento !== undefined)
      data.dataPagamento = dto.dataPagamento
        ? isoParaData(dto.dataPagamento)
        : null;
    if (dto.observacoes !== undefined)
      data.observacoes = dto.observacoes ?? null;

    const r = await this.prisma.recebivel.update({ where: { id }, data });
    return this.toApi(r);
  }

  async remove(id: string) {
    await this.ensure(id);
    await this.prisma.recebivel.delete({ where: { id } });
    return { ok: true };
  }

  private async ensure(id: string) {
    const r = await this.prisma.recebivel.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Recebível não encontrado');
    return r;
  }
}
