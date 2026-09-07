import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateRecebivelDto,
  UpdateRecebivelDto,
} from './dto/recebivel.dto';
import { CreateBaixaDto } from './dto/baixa.dto';
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
  valorPago: number;
  saldoDevedor: number;
  pago: boolean;
  dataPagamento: string | null;
  // Condição de pagamento (texto livre) — alternativa à dataPagamento
  // quando ainda não há uma data definida.
  condicaoPagamento: string | null;
  observacoes: string | null;
}

export interface BaixaApi {
  id: string;
  data: string;
  valor: number;
  formaPagamento: string;
  observacao: string | null;
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
    valorPagoCentavos: number;
    pago: boolean;
    dataPagamento: Date | null;
    condicaoPagamento: string | null;
    observacoes: string | null;
  }): RecebivelApi {
    return {
      id: r.id,
      data: dataParaIso(r.data) as string,
      empresa: r.empresa,
      cnpj: r.cnpj,
      descricao: r.descricao,
      valor: centavosParaReais(r.valorCentavos),
      valorPago: centavosParaReais(r.valorPagoCentavos),
      saldoDevedor: centavosParaReais(r.valorCentavos - r.valorPagoCentavos),
      pago: r.pago,
      dataPagamento: dataParaIso(r.dataPagamento),
      condicaoPagamento: r.condicaoPagamento ?? null,
      observacoes: r.observacoes,
    };
  }

  private toBaixaApi(b: {
    id: string;
    data: Date;
    valorCentavos: number;
    formaPagamento: string;
    observacao: string | null;
  }): BaixaApi {
    return {
      id: b.id,
      data: dataParaIso(b.data) as string,
      valor: centavosParaReais(b.valorCentavos),
      formaPagamento: b.formaPagamento,
      observacao: b.observacao,
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
        valorPagoCentavos: reaisParaCentavos(dto.valorPago ?? 0),
        pago: dto.pago ?? false,
        dataPagamento: dto.dataPagamento ? isoParaData(dto.dataPagamento) : null,
        condicaoPagamento: dto.dataPagamento ? null : dto.condicaoPagamento || null,
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
    if (dto.valorPago !== undefined)
      data.valorPagoCentavos = reaisParaCentavos(dto.valorPago);
    if (dto.pago !== undefined) data.pago = dto.pago;
    if (dto.dataPagamento !== undefined)
      data.dataPagamento = dto.dataPagamento
        ? isoParaData(dto.dataPagamento)
        : null;
    // Condição de pagamento (texto) é mutuamente exclusiva com a data na UI;
    // garantimos aqui também que as duas nunca ficam preenchidas juntas.
    if (dto.condicaoPagamento !== undefined) {
      data.condicaoPagamento = dto.condicaoPagamento || null;
      if (dto.condicaoPagamento) data.dataPagamento = null;
    }
    if (dto.dataPagamento) data.condicaoPagamento = null;
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

  // ===== Baixas (recebimento total ou parcial, com histórico) =====
  async listarBaixas(recebivelId: string): Promise<BaixaApi[]> {
    await this.ensure(recebivelId);
    const baixas = await this.prisma.baixaRecebivel.findMany({
      where: { recebivelId },
      orderBy: { data: 'asc' },
    });
    return baixas.map((b) => this.toBaixaApi(b));
  }

  async registrarBaixa(
    recebivelId: string,
    dto: CreateBaixaDto,
  ): Promise<RecebivelApi> {
    const recebivel = await this.ensure(recebivelId);
    const valorCentavos = reaisParaCentavos(dto.valor);

    const atualizado = await this.prisma.$transaction(async (tx) => {
      await tx.baixaRecebivel.create({
        data: {
          recebivelId,
          data: isoParaData(dto.data),
          valorCentavos,
          formaPagamento: dto.formaPagamento,
          observacao: dto.observacao ?? null,
        },
      });
      const agg = await tx.baixaRecebivel.aggregate({
        where: { recebivelId },
        _sum: { valorCentavos: true },
      });
      const totalRecebido = agg._sum.valorCentavos ?? 0;
      const quitado = totalRecebido >= recebivel.valorCentavos;
      return tx.recebivel.update({
        where: { id: recebivelId },
        data: {
          valorPagoCentavos: totalRecebido,
          pago: quitado,
          dataPagamento: quitado
            ? (recebivel.dataPagamento ?? isoParaData(dto.data))
            : recebivel.dataPagamento,
        },
      });
    });

    return this.toApi(atualizado);
  }

  async removerBaixa(recebivelId: string, baixaId: string): Promise<RecebivelApi> {
    await this.ensure(recebivelId);
    const baixa = await this.prisma.baixaRecebivel.findUnique({
      where: { id: baixaId },
    });
    if (!baixa || baixa.recebivelId !== recebivelId) {
      throw new NotFoundException('Baixa não encontrada para este recebível.');
    }

    const atualizado = await this.prisma.$transaction(async (tx) => {
      await tx.baixaRecebivel.delete({ where: { id: baixaId } });
      const agg = await tx.baixaRecebivel.aggregate({
        where: { recebivelId },
        _sum: { valorCentavos: true },
      });
      const totalRecebido = agg._sum.valorCentavos ?? 0;
      const r = await tx.recebivel.findUniqueOrThrow({ where: { id: recebivelId } });
      return tx.recebivel.update({
        where: { id: recebivelId },
        data: {
          valorPagoCentavos: totalRecebido,
          pago: totalRecebido >= r.valorCentavos && totalRecebido > 0,
        },
      });
    });

    return this.toApi(atualizado);
  }
}
