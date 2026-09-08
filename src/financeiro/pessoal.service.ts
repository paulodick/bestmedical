import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateDespesaPessoalDto,
  UpdateDespesaPessoalDto,
} from './dto/despesa-pessoal.dto';
import {
  CreateRecebivelPessoalDto,
  UpdateRecebivelPessoalDto,
} from './dto/recebivel-pessoal.dto';
import { CreateBaixaDto } from './dto/baixa.dto';
import { PrioridadeDespesa } from './dto/despesa.dto';
import { PaginationDto, Paginated } from '../common/dto/pagination.dto';
import {
  reaisParaCentavos,
  centavosParaReais,
} from '../orcamentos/orcamento.calc';
import { Prisma } from '@prisma/client';
import { FluxoCaixaLancamento } from './despesas.service';

export interface DespesaPessoalApi {
  id: string;
  data: string;
  pessoa: string;
  fornecedor: string;
  categoria: string | null;
  descricao: string | null;
  valor: number;
  valorPago: number;
  saldoDevedor: number;
  pago: boolean;
  dataPagamento: string | null;
  observacoes: string | null;
  prioridade: PrioridadeDespesa | null;
}

export interface RecebivelPessoalApi {
  id: string;
  data: string;
  pessoa: string;
  origem: string;
  descricao: string | null;
  valor: number;
  valorPago: number;
  saldoDevedor: number;
  pago: boolean;
  dataPagamento: string | null;
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

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class PessoalService {
  constructor(private prisma: PrismaService) {}

  // ===================== Despesas =====================

  private toDespesaApi(d: {
    id: string;
    data: Date;
    pessoa: string;
    fornecedor: string;
    categoria: string | null;
    descricao: string | null;
    valorCentavos: number;
    valorPagoCentavos: number;
    pago: boolean;
    dataPagamento: Date | null;
    observacoes: string | null;
    prioridade: string | null;
  }): DespesaPessoalApi {
    return {
      id: d.id,
      data: dataParaIso(d.data) as string,
      pessoa: d.pessoa,
      fornecedor: d.fornecedor,
      categoria: d.categoria,
      descricao: d.descricao,
      valor: centavosParaReais(d.valorCentavos),
      valorPago: centavosParaReais(d.valorPagoCentavos),
      saldoDevedor: centavosParaReais(d.valorCentavos - d.valorPagoCentavos),
      pago: d.pago,
      dataPagamento: dataParaIso(d.dataPagamento),
      observacoes: d.observacoes,
      prioridade: (d.prioridade as PrioridadeDespesa) ?? null,
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

  async listDespesas(q: PaginationDto): Promise<Paginated<DespesaPessoalApi>> {
    const where: Prisma.DespesaPessoalWhereInput = q.busca
      ? {
          OR: [
            { pessoa: { contains: q.busca, mode: 'insensitive' } },
            { fornecedor: { contains: q.busca, mode: 'insensitive' } },
            { categoria: { contains: q.busca, mode: 'insensitive' } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.despesaPessoal.findMany({
        where,
        orderBy: [{ data: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.despesaPessoal.count({ where }),
    ]);

    return {
      data: data.map((d) => this.toDespesaApi(d)),
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.ceil(total / q.pageSize) || 1,
    };
  }

  async createDespesa(dto: CreateDespesaPessoalDto): Promise<DespesaPessoalApi> {
    const d = await this.prisma.despesaPessoal.create({
      data: {
        data: isoParaData(dto.data),
        pessoa: dto.pessoa,
        fornecedor: dto.fornecedor,
        categoria: dto.categoria ?? null,
        descricao: dto.descricao ?? null,
        valorCentavos: reaisParaCentavos(dto.valor),
        valorPagoCentavos: reaisParaCentavos(dto.valorPago ?? 0),
        pago: dto.pago ?? false,
        dataPagamento: dto.dataPagamento ? isoParaData(dto.dataPagamento) : null,
        observacoes: dto.observacoes ?? null,
        prioridade: dto.prioridade ?? null,
      },
    });
    return this.toDespesaApi(d);
  }

  async updateDespesa(
    id: string,
    dto: UpdateDespesaPessoalDto,
  ): Promise<DespesaPessoalApi> {
    await this.ensureDespesa(id);
    const data: Prisma.DespesaPessoalUpdateInput = {};
    if (dto.data !== undefined) data.data = isoParaData(dto.data);
    if (dto.pessoa !== undefined) data.pessoa = dto.pessoa;
    if (dto.fornecedor !== undefined) data.fornecedor = dto.fornecedor;
    if (dto.categoria !== undefined) data.categoria = dto.categoria ?? null;
    if (dto.descricao !== undefined) data.descricao = dto.descricao ?? null;
    if (dto.valor !== undefined) data.valorCentavos = reaisParaCentavos(dto.valor);
    if (dto.valorPago !== undefined)
      data.valorPagoCentavos = reaisParaCentavos(dto.valorPago);
    if (dto.pago !== undefined) data.pago = dto.pago;
    if (dto.dataPagamento !== undefined)
      data.dataPagamento = dto.dataPagamento ? isoParaData(dto.dataPagamento) : null;
    if (dto.observacoes !== undefined) data.observacoes = dto.observacoes ?? null;
    if (dto.prioridade !== undefined) data.prioridade = dto.prioridade ?? null;

    const d = await this.prisma.despesaPessoal.update({ where: { id }, data });
    return this.toDespesaApi(d);
  }

  async removeDespesa(id: string) {
    await this.ensureDespesa(id);
    await this.prisma.despesaPessoal.delete({ where: { id } });
    return { ok: true };
  }

  private async ensureDespesa(id: string) {
    const d = await this.prisma.despesaPessoal.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Despesa pessoal não encontrada');
    return d;
  }

  async listarBaixasDespesa(despesaId: string): Promise<BaixaApi[]> {
    await this.ensureDespesa(despesaId);
    const baixas = await this.prisma.baixaDespesaPessoal.findMany({
      where: { despesaId },
      orderBy: { data: 'asc' },
    });
    return baixas.map((b) => this.toBaixaApi(b));
  }

  async registrarBaixaDespesa(
    despesaId: string,
    dto: CreateBaixaDto,
  ): Promise<DespesaPessoalApi> {
    const despesa = await this.ensureDespesa(despesaId);
    const valorCentavos = reaisParaCentavos(dto.valor);

    const atualizada = await this.prisma.$transaction(async (tx) => {
      await tx.baixaDespesaPessoal.create({
        data: {
          despesaId,
          data: isoParaData(dto.data),
          valorCentavos,
          formaPagamento: dto.formaPagamento,
          observacao: dto.observacao ?? null,
        },
      });
      const agg = await tx.baixaDespesaPessoal.aggregate({
        where: { despesaId },
        _sum: { valorCentavos: true },
      });
      const totalPago = agg._sum.valorCentavos ?? 0;
      const quitada = totalPago >= despesa.valorCentavos;
      return tx.despesaPessoal.update({
        where: { id: despesaId },
        data: {
          valorPagoCentavos: totalPago,
          pago: quitada,
          dataPagamento: quitada
            ? (despesa.dataPagamento ?? isoParaData(dto.data))
            : despesa.dataPagamento,
        },
      });
    });

    return this.toDespesaApi(atualizada);
  }

  async removerBaixaDespesa(
    despesaId: string,
    baixaId: string,
  ): Promise<DespesaPessoalApi> {
    await this.ensureDespesa(despesaId);
    const baixa = await this.prisma.baixaDespesaPessoal.findUnique({
      where: { id: baixaId },
    });
    if (!baixa || baixa.despesaId !== despesaId) {
      throw new NotFoundException('Baixa não encontrada para esta despesa.');
    }

    const atualizada = await this.prisma.$transaction(async (tx) => {
      await tx.baixaDespesaPessoal.delete({ where: { id: baixaId } });
      const agg = await tx.baixaDespesaPessoal.aggregate({
        where: { despesaId },
        _sum: { valorCentavos: true },
      });
      const totalPago = agg._sum.valorCentavos ?? 0;
      const d = await tx.despesaPessoal.findUniqueOrThrow({ where: { id: despesaId } });
      return tx.despesaPessoal.update({
        where: { id: despesaId },
        data: {
          valorPagoCentavos: totalPago,
          pago: totalPago >= d.valorCentavos && totalPago > 0,
        },
      });
    });

    return this.toDespesaApi(atualizada);
  }

  // ===================== Recebíveis =====================

  private toRecebivelApi(r: {
    id: string;
    data: Date;
    pessoa: string;
    origem: string;
    descricao: string | null;
    valorCentavos: number;
    valorPagoCentavos: number;
    pago: boolean;
    dataPagamento: Date | null;
    condicaoPagamento: string | null;
    observacoes: string | null;
  }): RecebivelPessoalApi {
    return {
      id: r.id,
      data: dataParaIso(r.data) as string,
      pessoa: r.pessoa,
      origem: r.origem,
      descricao: r.descricao,
      valor: centavosParaReais(r.valorCentavos),
      valorPago: centavosParaReais(r.valorPagoCentavos),
      saldoDevedor: centavosParaReais(r.valorCentavos - r.valorPagoCentavos),
      pago: r.pago,
      dataPagamento: dataParaIso(r.dataPagamento),
      condicaoPagamento: r.condicaoPagamento,
      observacoes: r.observacoes,
    };
  }

  async listRecebiveis(q: PaginationDto): Promise<Paginated<RecebivelPessoalApi>> {
    const where: Prisma.RecebivelPessoalWhereInput = q.busca
      ? {
          OR: [
            { pessoa: { contains: q.busca, mode: 'insensitive' } },
            { origem: { contains: q.busca, mode: 'insensitive' } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.recebivelPessoal.findMany({
        where,
        orderBy: [{ data: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.recebivelPessoal.count({ where }),
    ]);

    return {
      data: data.map((r) => this.toRecebivelApi(r)),
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.ceil(total / q.pageSize) || 1,
    };
  }

  async createRecebivel(
    dto: CreateRecebivelPessoalDto,
  ): Promise<RecebivelPessoalApi> {
    const r = await this.prisma.recebivelPessoal.create({
      data: {
        data: isoParaData(dto.data),
        pessoa: dto.pessoa,
        origem: dto.origem,
        descricao: dto.descricao ?? null,
        valorCentavos: reaisParaCentavos(dto.valor),
        valorPagoCentavos: reaisParaCentavos(dto.valorPago ?? 0),
        pago: dto.pago ?? false,
        dataPagamento: dto.dataPagamento ? isoParaData(dto.dataPagamento) : null,
        condicaoPagamento: dto.dataPagamento ? null : dto.condicaoPagamento || null,
        observacoes: dto.observacoes ?? null,
      },
    });
    return this.toRecebivelApi(r);
  }

  async updateRecebivel(
    id: string,
    dto: UpdateRecebivelPessoalDto,
  ): Promise<RecebivelPessoalApi> {
    await this.ensureRecebivel(id);
    const data: Prisma.RecebivelPessoalUpdateInput = {};
    if (dto.data !== undefined) data.data = isoParaData(dto.data);
    if (dto.pessoa !== undefined) data.pessoa = dto.pessoa;
    if (dto.origem !== undefined) data.origem = dto.origem;
    if (dto.descricao !== undefined) data.descricao = dto.descricao ?? null;
    if (dto.valor !== undefined) data.valorCentavos = reaisParaCentavos(dto.valor);
    if (dto.valorPago !== undefined)
      data.valorPagoCentavos = reaisParaCentavos(dto.valorPago);
    if (dto.pago !== undefined) data.pago = dto.pago;
    if (dto.dataPagamento !== undefined)
      data.dataPagamento = dto.dataPagamento ? isoParaData(dto.dataPagamento) : null;
    if (dto.condicaoPagamento !== undefined) {
      data.condicaoPagamento = dto.condicaoPagamento || null;
      if (dto.condicaoPagamento) data.dataPagamento = null;
    }
    if (dto.dataPagamento) data.condicaoPagamento = null;
    if (dto.observacoes !== undefined) data.observacoes = dto.observacoes ?? null;

    const r = await this.prisma.recebivelPessoal.update({ where: { id }, data });
    return this.toRecebivelApi(r);
  }

  async removeRecebivel(id: string) {
    await this.ensureRecebivel(id);
    await this.prisma.recebivelPessoal.delete({ where: { id } });
    return { ok: true };
  }

  private async ensureRecebivel(id: string) {
    const r = await this.prisma.recebivelPessoal.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Recebível pessoal não encontrado');
    return r;
  }

  async listarBaixasRecebivel(recebivelId: string): Promise<BaixaApi[]> {
    await this.ensureRecebivel(recebivelId);
    const baixas = await this.prisma.baixaRecebivelPessoal.findMany({
      where: { recebivelId },
      orderBy: { data: 'asc' },
    });
    return baixas.map((b) => this.toBaixaApi(b));
  }

  async registrarBaixaRecebivel(
    recebivelId: string,
    dto: CreateBaixaDto,
  ): Promise<RecebivelPessoalApi> {
    const recebivel = await this.ensureRecebivel(recebivelId);
    const valorCentavos = reaisParaCentavos(dto.valor);

    const atualizado = await this.prisma.$transaction(async (tx) => {
      await tx.baixaRecebivelPessoal.create({
        data: {
          recebivelId,
          data: isoParaData(dto.data),
          valorCentavos,
          formaPagamento: dto.formaPagamento,
          observacao: dto.observacao ?? null,
        },
      });
      const agg = await tx.baixaRecebivelPessoal.aggregate({
        where: { recebivelId },
        _sum: { valorCentavos: true },
      });
      const totalRecebido = agg._sum.valorCentavos ?? 0;
      const quitado = totalRecebido >= recebivel.valorCentavos;
      return tx.recebivelPessoal.update({
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

    return this.toRecebivelApi(atualizado);
  }

  async removerBaixaRecebivel(
    recebivelId: string,
    baixaId: string,
  ): Promise<RecebivelPessoalApi> {
    await this.ensureRecebivel(recebivelId);
    const baixa = await this.prisma.baixaRecebivelPessoal.findUnique({
      where: { id: baixaId },
    });
    if (!baixa || baixa.recebivelId !== recebivelId) {
      throw new NotFoundException('Baixa não encontrada para este recebível.');
    }

    const atualizado = await this.prisma.$transaction(async (tx) => {
      await tx.baixaRecebivelPessoal.delete({ where: { id: baixaId } });
      const agg = await tx.baixaRecebivelPessoal.aggregate({
        where: { recebivelId },
        _sum: { valorCentavos: true },
      });
      const totalRecebido = agg._sum.valorCentavos ?? 0;
      const r = await tx.recebivelPessoal.findUniqueOrThrow({
        where: { id: recebivelId },
      });
      return tx.recebivelPessoal.update({
        where: { id: recebivelId },
        data: {
          valorPagoCentavos: totalRecebido,
          pago: totalRecebido >= r.valorCentavos && totalRecebido > 0,
        },
      });
    });

    return this.toRecebivelApi(atualizado);
  }

  // ===================== Fluxo de Caixa (pessoal) =====================
  // Mesma ideia do fluxoCaixa() da empresa, mas só com Despesa/Recebível
  // pessoais (sem orçamento/proposta). Parte já recebida: uma linha por
  // baixa registrada (data real). Saldo ainda não recebido de cada
  // recebível: uma linha prevista, na data de pagamento estimada (mesma
  // exibida na página Recebíveis Pessoais) — permite prever o caixa do mês.
  async fluxoCaixa(): Promise<FluxoCaixaLancamento[]> {
    const [baixasDespesa, baixasRecebivel, recebiveis] = await Promise.all([
      this.prisma.baixaDespesaPessoal.findMany({
        include: {
          despesa: { select: { fornecedor: true, categoria: true, descricao: true, pessoa: true } },
        },
      }),
      this.prisma.baixaRecebivelPessoal.findMany({
        include: { recebivel: { select: { origem: true, descricao: true, pessoa: true } } },
      }),
      this.prisma.recebivelPessoal.findMany({
        select: {
          id: true,
          data: true,
          origem: true,
          descricao: true,
          pessoa: true,
          valorCentavos: true,
          valorPagoCentavos: true,
          dataPagamento: true,
        },
      }),
    ]);

    const lancamentos: FluxoCaixaLancamento[] = [
      ...baixasRecebivel.map((b) => ({
        id: `recp-baixa-${b.id}`,
        data: dataParaIso(b.data) as string,
        tipo: 'entrada' as const,
        origem: `${b.recebivel.origem} (${b.recebivel.pessoa})`,
        descricao: b.recebivel.descricao || b.recebivel.origem,
        categoria: 'Pessoal',
        valor: centavosParaReais(b.valorCentavos),
      })),
      ...recebiveis
        .filter((r) => r.valorCentavos - r.valorPagoCentavos > 0)
        .map((r) => ({
          id: `recp-previsto-${r.id}`,
          data: dataParaIso(r.dataPagamento ?? r.data) as string,
          tipo: 'entrada' as const,
          origem: `${r.origem} (${r.pessoa})`,
          descricao: r.descricao || r.origem,
          categoria: 'Pessoal',
          valor: centavosParaReais(r.valorCentavos - r.valorPagoCentavos),
          previsto: true,
        })),
      ...baixasDespesa.map((b) => ({
        id: `despp-baixa-${b.id}`,
        data: dataParaIso(b.data) as string,
        tipo: 'saida' as const,
        origem: `${b.despesa.fornecedor} (${b.despesa.pessoa})`,
        descricao: b.despesa.descricao || b.despesa.fornecedor,
        categoria: b.despesa.categoria || 'Sem categoria',
        valor: centavosParaReais(b.valorCentavos),
      })),
    ];

    return lancamentos.sort((a, b) => a.data.localeCompare(b.data));
  }

  // ===== Resumo financeiro pessoal (Dashboard) =====
  async resumo() {
    const hoje = hojeIso();
    const [despesas, recebiveis, baixasDespesa, baixasRecebivel] = await Promise.all([
      this.prisma.despesaPessoal.findMany({
        select: {
          id: true,
          data: true,
          fornecedor: true,
          dataPagamento: true,
          valorCentavos: true,
          valorPagoCentavos: true,
          pago: true,
          categoria: true,
        },
      }),
      this.prisma.recebivelPessoal.findMany({
        select: {
          id: true,
          origem: true,
          dataPagamento: true,
          valorCentavos: true,
          valorPagoCentavos: true,
          pago: true,
        },
      }),
      this.prisma.baixaDespesaPessoal.findMany({
        select: { data: true, valorCentavos: true },
      }),
      this.prisma.baixaRecebivelPessoal.findMany({
        select: { data: true, valorCentavos: true },
      }),
    ]);

    const receitaTotalCent = recebiveis.reduce((s, r) => s + r.valorCentavos, 0);
    const receitaRecebidaCent = recebiveis.reduce(
      (s, r) => s + (r.pago ? r.valorCentavos : r.valorPagoCentavos),
      0,
    );
    const receitaAbertaCent = receitaTotalCent - receitaRecebidaCent;

    const despesaTotalCent = despesas.reduce((s, d) => s + d.valorCentavos, 0);
    const despesaPagaCent = despesas.reduce(
      (s, d) => s + (d.pago ? d.valorCentavos : d.valorPagoCentavos),
      0,
    );
    const despesaPendenteCent = despesaTotalCent - despesaPagaCent;

    const meses: string[] = [];
    const agora = new Date();
    for (let i = 11; i >= 0; i--) {
      const dt = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - i, 1));
      meses.push(dt.toISOString().slice(0, 7));
    }
    const chaveMes = (d: Date | null): string | null =>
      d ? d.toISOString().slice(0, 7) : null;

    const fluxo = meses.map((mes) => {
      const entrada = baixasRecebivel
        .filter((b) => chaveMes(b.data) === mes)
        .reduce((s, b) => s + b.valorCentavos, 0);
      const saida = baixasDespesa
        .filter((b) => chaveMes(b.data) === mes)
        .reduce((s, b) => s + b.valorCentavos, 0);
      return {
        mes,
        entrada: centavosParaReais(entrada),
        saida: centavosParaReais(saida),
        saldo: centavosParaReais(entrada - saida),
      };
    });

    let acumulado = 0;
    const saldoAcumulado = fluxo.map((f) => {
      acumulado += f.saldo;
      return { mes: f.mes, saldo: Number(acumulado.toFixed(2)) };
    });

    const porCategoriaMap = new Map<string, number>();
    for (const d of despesas) {
      const cat = (d.categoria || 'Sem categoria').trim() || 'Sem categoria';
      porCategoriaMap.set(cat, (porCategoriaMap.get(cat) ?? 0) + d.valorCentavos);
    }
    const despesasPorCategoria = Array.from(porCategoriaMap.entries())
      .map(([categoria, cent]) => ({ categoria, valor: centavosParaReais(cent) }))
      .sort((a, b) => b.valor - a.valor);

    const despesaAtrasadaCent = despesas
      .filter((d) => !d.pago && dataParaIso(d.dataPagamento ?? d.data)! < hoje)
      .reduce((s, d) => s + (d.valorCentavos - d.valorPagoCentavos), 0);
    const contasAPagar = {
      total: centavosParaReais(despesaTotalCent),
      aPagar: centavosParaReais(despesaPendenteCent),
      atrasado: centavosParaReais(despesaAtrasadaCent),
    };

    const recAbertoCent = recebiveis
      .filter((r) => !r.pago)
      .reduce((s, r) => s + (r.valorCentavos - r.valorPagoCentavos), 0);
    const recAtrasadoCent = recebiveis
      .filter((r) => !r.pago && dataParaIso(r.dataPagamento)! < hoje)
      .reduce((s, r) => s + (r.valorCentavos - r.valorPagoCentavos), 0);
    const contasAReceber = {
      total: centavosParaReais(receitaTotalCent),
      aReceber: centavosParaReais(recAbertoCent),
      atrasado: centavosParaReais(recAtrasadoCent),
    };

    const [ultimasBaixasDespesa, ultimasBaixasRecebivel] = await Promise.all([
      this.prisma.baixaDespesaPessoal.findMany({
        orderBy: { data: 'desc' },
        take: 8,
        include: { despesa: { select: { fornecedor: true } } },
      }),
      this.prisma.baixaRecebivelPessoal.findMany({
        orderBy: { data: 'desc' },
        take: 8,
        include: { recebivel: { select: { origem: true } } },
      }),
    ]);
    const atividadeRecente = [
      ...ultimasBaixasDespesa.map((b) => ({
        tipo: 'saida' as const,
        nome: b.despesa.fornecedor,
        valor: centavosParaReais(b.valorCentavos),
        data: dataParaIso(b.data) as string,
        formaPagamento: b.formaPagamento,
      })),
      ...ultimasBaixasRecebivel.map((b) => ({
        tipo: 'entrada' as const,
        nome: b.recebivel.origem,
        valor: centavosParaReais(b.valorCentavos),
        data: dataParaIso(b.data) as string,
        formaPagamento: b.formaPagamento,
      })),
    ]
      .sort((a, b) => b.data.localeCompare(a.data))
      .slice(0, 8);

    return {
      kpis: {
        receitaRecebida: centavosParaReais(receitaRecebidaCent),
        receitaAberta: centavosParaReais(receitaAbertaCent),
        despesaTotal: centavosParaReais(despesaTotalCent),
        despesaPaga: centavosParaReais(despesaPagaCent),
        despesaPendente: centavosParaReais(despesaPendenteCent),
        resultado: centavosParaReais(receitaRecebidaCent - despesaPagaCent),
      },
      fluxo,
      saldoAcumulado,
      despesasPorCategoria,
      contasAPagar,
      contasAReceber,
      atividadeRecente,
    };
  }
}
