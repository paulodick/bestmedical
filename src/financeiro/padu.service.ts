import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDespesaPaduDto, UpdateDespesaPaduDto } from './dto/despesa-padu.dto';
import { CreateRecebivelPaduDto, UpdateRecebivelPaduDto } from './dto/recebivel-padu.dto';
import { CreateBaixaDto } from './dto/baixa.dto';
import { PrioridadeDespesa } from './dto/despesa.dto';
import { PaginationDto, Paginated } from '../common/dto/pagination.dto';
import { reaisParaCentavos, centavosParaReais } from '../orcamentos/orcamento.calc';
import { Prisma } from '@prisma/client';
import { FluxoCaixaLancamento } from './despesas.service';

export interface DespesaPaduApi {
  id: string;
  data: string;
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

export interface RecebivelPaduApi {
  id: string;
  data: string;
  empresa: string;
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

// Controle Financeiro da Padu Studios — empresa separada da Best Medical,
// dados em schema Postgres próprio ("padu"), sem nenhuma relação com "public".
// Estrutura idêntica ao PessoalService (baixa parcial com histórico), só que
// sem o campo "pessoa" (é uma empresa, não uma pessoa física).
@Injectable()
export class PaduService {
  constructor(private prisma: PrismaService) {}

  // ===================== Despesas =====================

  private toDespesaApi(d: {
    id: string;
    data: Date;
    fornecedor: string;
    categoria: string | null;
    descricao: string | null;
    valorCentavos: number;
    valorPagoCentavos: number;
    pago: boolean;
    dataPagamento: Date | null;
    observacoes: string | null;
    prioridade: string | null;
  }): DespesaPaduApi {
    return {
      id: d.id,
      data: dataParaIso(d.data) as string,
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

  async listDespesas(q: PaginationDto): Promise<Paginated<DespesaPaduApi>> {
    const where: Prisma.DespesaPaduWhereInput = q.busca
      ? {
          OR: [
            { fornecedor: { contains: q.busca, mode: 'insensitive' } },
            { categoria: { contains: q.busca, mode: 'insensitive' } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.despesaPadu.findMany({
        where,
        orderBy: [{ data: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.despesaPadu.count({ where }),
    ]);

    return {
      data: data.map((d) => this.toDespesaApi(d)),
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.ceil(total / q.pageSize) || 1,
    };
  }

  async createDespesa(dto: CreateDespesaPaduDto): Promise<DespesaPaduApi> {
    const d = await this.prisma.despesaPadu.create({
      data: {
        data: isoParaData(dto.data),
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

  async updateDespesa(id: string, dto: UpdateDespesaPaduDto): Promise<DespesaPaduApi> {
    await this.ensureDespesa(id);
    const data: Prisma.DespesaPaduUpdateInput = {};
    if (dto.data !== undefined) data.data = isoParaData(dto.data);
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

    const d = await this.prisma.despesaPadu.update({ where: { id }, data });
    return this.toDespesaApi(d);
  }

  async removeDespesa(id: string) {
    await this.ensureDespesa(id);
    await this.prisma.despesaPadu.delete({ where: { id } });
    return { ok: true };
  }

  private async ensureDespesa(id: string) {
    const d = await this.prisma.despesaPadu.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Despesa não encontrada');
    return d;
  }

  async listarBaixasDespesa(despesaId: string): Promise<BaixaApi[]> {
    await this.ensureDespesa(despesaId);
    const baixas = await this.prisma.baixaDespesaPadu.findMany({
      where: { despesaId },
      orderBy: { data: 'asc' },
    });
    return baixas.map((b) => this.toBaixaApi(b));
  }

  async registrarBaixaDespesa(
    despesaId: string,
    dto: CreateBaixaDto,
  ): Promise<DespesaPaduApi> {
    const despesa = await this.ensureDespesa(despesaId);
    const valorCentavos = reaisParaCentavos(dto.valor);

    const atualizada = await this.prisma.$transaction(async (tx) => {
      await tx.baixaDespesaPadu.create({
        data: {
          despesaId,
          data: isoParaData(dto.data),
          valorCentavos,
          formaPagamento: dto.formaPagamento,
          observacao: dto.observacao ?? null,
        },
      });
      const agg = await tx.baixaDespesaPadu.aggregate({
        where: { despesaId },
        _sum: { valorCentavos: true },
      });
      const totalPago = agg._sum.valorCentavos ?? 0;
      const quitada = totalPago >= despesa.valorCentavos;
      return tx.despesaPadu.update({
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

  async removerBaixaDespesa(despesaId: string, baixaId: string): Promise<DespesaPaduApi> {
    await this.ensureDespesa(despesaId);
    const baixa = await this.prisma.baixaDespesaPadu.findUnique({ where: { id: baixaId } });
    if (!baixa || baixa.despesaId !== despesaId) {
      throw new NotFoundException('Baixa não encontrada para esta despesa.');
    }

    const atualizada = await this.prisma.$transaction(async (tx) => {
      await tx.baixaDespesaPadu.delete({ where: { id: baixaId } });
      const agg = await tx.baixaDespesaPadu.aggregate({
        where: { despesaId },
        _sum: { valorCentavos: true },
      });
      const totalPago = agg._sum.valorCentavos ?? 0;
      const d = await tx.despesaPadu.findUniqueOrThrow({ where: { id: despesaId } });
      return tx.despesaPadu.update({
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
    empresa: string;
    descricao: string | null;
    valorCentavos: number;
    valorPagoCentavos: number;
    pago: boolean;
    dataPagamento: Date | null;
    condicaoPagamento: string | null;
    observacoes: string | null;
  }): RecebivelPaduApi {
    return {
      id: r.id,
      data: dataParaIso(r.data) as string,
      empresa: r.empresa,
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

  async listRecebiveis(q: PaginationDto): Promise<Paginated<RecebivelPaduApi>> {
    const where: Prisma.RecebivelPaduWhereInput = q.busca
      ? { empresa: { contains: q.busca, mode: 'insensitive' } }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.recebivelPadu.findMany({
        where,
        orderBy: [{ data: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.recebivelPadu.count({ where }),
    ]);

    return {
      data: data.map((r) => this.toRecebivelApi(r)),
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.ceil(total / q.pageSize) || 1,
    };
  }

  async createRecebivel(dto: CreateRecebivelPaduDto): Promise<RecebivelPaduApi> {
    const r = await this.prisma.recebivelPadu.create({
      data: {
        data: isoParaData(dto.data),
        empresa: dto.empresa,
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

  async updateRecebivel(id: string, dto: UpdateRecebivelPaduDto): Promise<RecebivelPaduApi> {
    await this.ensureRecebivel(id);
    const data: Prisma.RecebivelPaduUpdateInput = {};
    if (dto.data !== undefined) data.data = isoParaData(dto.data);
    if (dto.empresa !== undefined) data.empresa = dto.empresa;
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

    const r = await this.prisma.recebivelPadu.update({ where: { id }, data });
    return this.toRecebivelApi(r);
  }

  async removeRecebivel(id: string) {
    await this.ensureRecebivel(id);
    await this.prisma.recebivelPadu.delete({ where: { id } });
    return { ok: true };
  }

  private async ensureRecebivel(id: string) {
    const r = await this.prisma.recebivelPadu.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Recebível não encontrado');
    return r;
  }

  async listarBaixasRecebivel(recebivelId: string): Promise<BaixaApi[]> {
    await this.ensureRecebivel(recebivelId);
    const baixas = await this.prisma.baixaRecebivelPadu.findMany({
      where: { recebivelId },
      orderBy: { data: 'asc' },
    });
    return baixas.map((b) => this.toBaixaApi(b));
  }

  async registrarBaixaRecebivel(
    recebivelId: string,
    dto: CreateBaixaDto,
  ): Promise<RecebivelPaduApi> {
    const recebivel = await this.ensureRecebivel(recebivelId);
    const valorCentavos = reaisParaCentavos(dto.valor);

    const atualizado = await this.prisma.$transaction(async (tx) => {
      await tx.baixaRecebivelPadu.create({
        data: {
          recebivelId,
          data: isoParaData(dto.data),
          valorCentavos,
          formaPagamento: dto.formaPagamento,
          observacao: dto.observacao ?? null,
        },
      });
      const agg = await tx.baixaRecebivelPadu.aggregate({
        where: { recebivelId },
        _sum: { valorCentavos: true },
      });
      const totalRecebido = agg._sum.valorCentavos ?? 0;
      const quitado = totalRecebido >= recebivel.valorCentavos;
      return tx.recebivelPadu.update({
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
  ): Promise<RecebivelPaduApi> {
    await this.ensureRecebivel(recebivelId);
    const baixa = await this.prisma.baixaRecebivelPadu.findUnique({
      where: { id: baixaId },
    });
    if (!baixa || baixa.recebivelId !== recebivelId) {
      throw new NotFoundException('Baixa não encontrada para este recebível.');
    }

    const atualizado = await this.prisma.$transaction(async (tx) => {
      await tx.baixaRecebivelPadu.delete({ where: { id: baixaId } });
      const agg = await tx.baixaRecebivelPadu.aggregate({
        where: { recebivelId },
        _sum: { valorCentavos: true },
      });
      const totalRecebido = agg._sum.valorCentavos ?? 0;
      const r = await tx.recebivelPadu.findUniqueOrThrow({ where: { id: recebivelId } });
      return tx.recebivelPadu.update({
        where: { id: recebivelId },
        data: {
          valorPagoCentavos: totalRecebido,
          pago: totalRecebido >= r.valorCentavos && totalRecebido > 0,
        },
      });
    });

    return this.toRecebivelApi(atualizado);
  }

  // ===================== Fluxo de Caixa =====================
  async fluxoCaixa(): Promise<FluxoCaixaLancamento[]> {
    const [baixasDespesa, baixasRecebivel, recebiveis] = await Promise.all([
      this.prisma.baixaDespesaPadu.findMany({
        include: { despesa: { select: { fornecedor: true, categoria: true, descricao: true } } },
      }),
      this.prisma.baixaRecebivelPadu.findMany({
        include: { recebivel: { select: { empresa: true, descricao: true } } },
      }),
      this.prisma.recebivelPadu.findMany({
        select: {
          id: true,
          data: true,
          empresa: true,
          descricao: true,
          valorCentavos: true,
          valorPagoCentavos: true,
          dataPagamento: true,
        },
      }),
    ]);

    const lancamentos: FluxoCaixaLancamento[] = [
      ...baixasRecebivel.map((b) => ({
        id: `padurec-baixa-${b.id}`,
        data: dataParaIso(b.data) as string,
        tipo: 'entrada' as const,
        origem: b.recebivel.empresa || '—',
        descricao: b.recebivel.descricao || 'Recebível avulso',
        categoria: 'Avulso',
        valor: centavosParaReais(b.valorCentavos),
      })),
      ...recebiveis
        .filter((r) => r.valorCentavos - r.valorPagoCentavos > 0)
        .map((r) => ({
          id: `padurec-previsto-${r.id}`,
          data: dataParaIso(r.dataPagamento ?? r.data) as string,
          tipo: 'entrada' as const,
          origem: r.empresa || '—',
          descricao: r.descricao || 'Recebível avulso',
          categoria: 'Avulso',
          valor: centavosParaReais(r.valorCentavos - r.valorPagoCentavos),
          previsto: true,
        })),
      ...baixasDespesa.map((b) => ({
        id: `padudesp-baixa-${b.id}`,
        data: dataParaIso(b.data) as string,
        tipo: 'saida' as const,
        origem: b.despesa.fornecedor,
        descricao: b.despesa.descricao || b.despesa.fornecedor,
        categoria: b.despesa.categoria || 'Sem categoria',
        valor: centavosParaReais(b.valorCentavos),
      })),
    ];

    return lancamentos.sort((a, b) => a.data.localeCompare(b.data));
  }

  // ===== Resumo financeiro (Dashboard) =====
  async resumo() {
    const hoje = hojeIso();
    const [despesas, recebiveis, baixasDespesa, baixasRecebivel] = await Promise.all([
      this.prisma.despesaPadu.findMany({
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
      this.prisma.recebivelPadu.findMany({
        select: {
          id: true,
          origem: true,
          dataPagamento: true,
          valorCentavos: true,
          valorPagoCentavos: true,
          pago: true,
        },
      }),
      this.prisma.baixaDespesaPadu.findMany({ select: { data: true, valorCentavos: true } }),
      this.prisma.baixaRecebivelPadu.findMany({ select: { data: true, valorCentavos: true } }),
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
    const chaveMes = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 7) : null);

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
      this.prisma.baixaDespesaPadu.findMany({
        orderBy: { data: 'desc' },
        take: 8,
        include: { despesa: { select: { fornecedor: true } } },
      }),
      this.prisma.baixaRecebivelPadu.findMany({
        orderBy: { data: 'desc' },
        take: 8,
        include: { recebivel: { select: { empresa: true } } },
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
        nome: b.recebivel.empresa,
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
