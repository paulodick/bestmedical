import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDespesaDto, UpdateDespesaDto } from './dto/despesa.dto';
import { PaginationDto, Paginated } from '../common/dto/pagination.dto';
import {
  reaisParaCentavos,
  centavosParaReais,
} from '../orcamentos/orcamento.calc';
import { Prisma } from '@prisma/client';

// Formato da despesa exposto ao frontend (valor em reais, datas ISO curtas).
export interface DespesaApi {
  id: string;
  data: string;
  fornecedor: string;
  categoria: string | null;
  descricao: string | null;
  valor: number;
  pago: boolean;
  dataPagamento: string | null;
  projeto: string | null;
  observacoes: string | null;
}

// Converte 'yyyy-mm-dd' para Date à meia-noite UTC (evita deslocamento de fuso).
function isoParaData(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

// Converte Date para 'yyyy-mm-dd'.
function dataParaIso(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class DespesasService {
  constructor(private prisma: PrismaService) {}

  private toApi(d: {
    id: string;
    data: Date;
    fornecedor: string;
    categoria: string | null;
    descricao: string | null;
    valorCentavos: number;
    pago: boolean;
    dataPagamento: Date | null;
    projeto: string | null;
    observacoes: string | null;
  }): DespesaApi {
    return {
      id: d.id,
      data: dataParaIso(d.data) as string,
      fornecedor: d.fornecedor,
      categoria: d.categoria,
      descricao: d.descricao,
      valor: centavosParaReais(d.valorCentavos),
      pago: d.pago,
      dataPagamento: dataParaIso(d.dataPagamento),
      projeto: d.projeto,
      observacoes: d.observacoes,
    };
  }

  // ===== Listagem com busca + paginação =====
  async list(q: PaginationDto): Promise<Paginated<DespesaApi>> {
    const where: Prisma.DespesaWhereInput = q.busca
      ? {
          OR: [
            { fornecedor: { contains: q.busca, mode: 'insensitive' } },
            { categoria: { contains: q.busca, mode: 'insensitive' } },
            { descricao: { contains: q.busca, mode: 'insensitive' } },
            { projeto: { contains: q.busca, mode: 'insensitive' } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.despesa.findMany({
        where,
        orderBy: [{ data: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.despesa.count({ where }),
    ]);

    return {
      data: data.map((d) => this.toApi(d)),
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.ceil(total / q.pageSize) || 1,
    };
  }

  async create(dto: CreateDespesaDto): Promise<DespesaApi> {
    const d = await this.prisma.despesa.create({
      data: {
        data: isoParaData(dto.data),
        fornecedor: dto.fornecedor,
        categoria: dto.categoria ?? null,
        descricao: dto.descricao ?? null,
        valorCentavos: reaisParaCentavos(dto.valor),
        pago: dto.pago ?? false,
        dataPagamento: dto.dataPagamento ? isoParaData(dto.dataPagamento) : null,
        projeto: dto.projeto ?? null,
        observacoes: dto.observacoes ?? null,
      },
    });
    return this.toApi(d);
  }

  async update(id: string, dto: UpdateDespesaDto): Promise<DespesaApi> {
    await this.ensure(id);

    // Atualização parcial (PATCH): só altera os campos realmente enviados.
    // Assim marcar apenas { pago: false } não zera os demais campos.
    const data: Prisma.DespesaUpdateInput = {};
    if (dto.data !== undefined) data.data = isoParaData(dto.data);
    if (dto.fornecedor !== undefined) data.fornecedor = dto.fornecedor;
    if (dto.categoria !== undefined) data.categoria = dto.categoria ?? null;
    if (dto.descricao !== undefined) data.descricao = dto.descricao ?? null;
    if (dto.valor !== undefined)
      data.valorCentavos = reaisParaCentavos(dto.valor);
    if (dto.pago !== undefined) data.pago = dto.pago;
    if (dto.dataPagamento !== undefined)
      data.dataPagamento = dto.dataPagamento
        ? isoParaData(dto.dataPagamento)
        : null;
    if (dto.projeto !== undefined) data.projeto = dto.projeto ?? null;
    if (dto.observacoes !== undefined)
      data.observacoes = dto.observacoes ?? null;

    const d = await this.prisma.despesa.update({ where: { id }, data });
    return this.toApi(d);
  }

  async remove(id: string) {
    await this.ensure(id);
    await this.prisma.despesa.delete({ where: { id } });
    return { ok: true };
  }

  private async ensure(id: string) {
    const d = await this.prisma.despesa.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Despesa não encontrada');
    return d;
  }

  // ===== Resumo financeiro (Dashboard + Fluxo de Caixa) =====
  // Cruza as saídas (Despesas) com as entradas (orçamentos/propostas pagos)
  // e devolve KPIs consolidados + série mensal para o gráfico de fluxo.
  async resumo() {
    const [despesas, orcamentos, propostas] = await Promise.all([
      this.prisma.despesa.findMany({
        select: {
          data: true,
          dataPagamento: true,
          valorCentavos: true,
          pago: true,
          categoria: true,
        },
      }),
      this.prisma.orcamento.findMany({
        select: {
          totalCentavos: true,
          totalManualCentavos: true,
          statusPago: true,
          statusCancelado: true,
          dataPagamento: true,
          createdAt: true,
        },
      }),
      this.prisma.proposta.findMany({
        select: {
          totalCentavos: true,
          totalManualCentavos: true,
          statusPago: true,
          statusCancelado: true,
          dataPagamento: true,
          createdAt: true,
        },
      }),
    ]);

    // ----- Totais de saída (despesas) -----
    const despesaTotalCent = despesas.reduce(
      (s, d) => s + d.valorCentavos,
      0,
    );
    const despesaPagaCent = despesas
      .filter((d) => d.pago)
      .reduce((s, d) => s + d.valorCentavos, 0);
    const despesaPendenteCent = despesaTotalCent - despesaPagaCent;

    // Total efetivo = total manual quando informado, senão o total calculado.
    const totalEfetivo = (r: {
      totalCentavos: number;
      totalManualCentavos: number | null;
    }) => r.totalManualCentavos ?? r.totalCentavos ?? 0;

    // ----- Totais de entrada (recebíveis pagos) -----
    const orcRecebidoCent = orcamentos
      .filter((o) => o.statusPago && !o.statusCancelado)
      .reduce((s, o) => s + totalEfetivo(o), 0);
    const propRecebidoCent = propostas
      .filter((p) => p.statusPago && !p.statusCancelado)
      .reduce((s, p) => s + totalEfetivo(p), 0);
    const receitaRecebidaCent = orcRecebidoCent + propRecebidoCent;

    // ----- Recebíveis em aberto (não pagos, não cancelados) -----
    const orcAbertoCent = orcamentos
      .filter((o) => !o.statusPago && !o.statusCancelado)
      .reduce((s, o) => s + totalEfetivo(o), 0);
    const propAbertoCent = propostas
      .filter((p) => !p.statusPago && !p.statusCancelado)
      .reduce((s, p) => s + totalEfetivo(p), 0);
    const receitaAbertaCent = orcAbertoCent + propAbertoCent;

    // ----- Série mensal (Fluxo de Caixa): últimos 12 meses -----
    const meses: string[] = [];
    const agora = new Date();
    for (let i = 11; i >= 0; i--) {
      const dt = new Date(
        Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - i, 1),
      );
      meses.push(dt.toISOString().slice(0, 7)); // yyyy-mm
    }

    const chaveMes = (d: Date | null): string | null =>
      d ? d.toISOString().slice(0, 7) : null;

    const fluxo = meses.map((mes) => {
      // Entradas: recebíveis pagos com dataPagamento naquele mês (ou createdAt
      // como fallback quando não há data de pagamento registrada).
      const entradaOrc = orcamentos
        .filter(
          (o) =>
            o.statusPago &&
            !o.statusCancelado &&
            (chaveMes(o.dataPagamento) ?? chaveMes(o.createdAt)) === mes,
        )
        .reduce((s, o) => s + totalEfetivo(o), 0);
      const entradaProp = propostas
        .filter(
          (p) =>
            p.statusPago &&
            !p.statusCancelado &&
            (chaveMes(p.dataPagamento) ?? chaveMes(p.createdAt)) === mes,
        )
        .reduce((s, p) => s + totalEfetivo(p), 0);

      // Saídas: despesas pagas com dataPagamento no mês (fallback: data).
      const saida = despesas
        .filter(
          (d) =>
            d.pago && (chaveMes(d.dataPagamento) ?? chaveMes(d.data)) === mes,
        )
        .reduce((s, d) => s + d.valorCentavos, 0);

      const entradaCent = entradaOrc + entradaProp;
      return {
        mes,
        entrada: centavosParaReais(entradaCent),
        saida: centavosParaReais(saida),
        saldo: centavosParaReais(entradaCent - saida),
      };
    });

    // ----- Despesas por categoria (para o Dashboard) -----
    const porCategoriaMap = new Map<string, number>();
    for (const d of despesas) {
      const cat = (d.categoria || 'Sem categoria').trim() || 'Sem categoria';
      porCategoriaMap.set(cat, (porCategoriaMap.get(cat) ?? 0) + d.valorCentavos);
    }
    const despesasPorCategoria = Array.from(porCategoriaMap.entries())
      .map(([categoria, cent]) => ({
        categoria,
        valor: centavosParaReais(cent),
      }))
      .sort((a, b) => b.valor - a.valor);

    return {
      kpis: {
        receitaRecebida: centavosParaReais(receitaRecebidaCent),
        receitaAberta: centavosParaReais(receitaAbertaCent),
        despesaTotal: centavosParaReais(despesaTotalCent),
        despesaPaga: centavosParaReais(despesaPagaCent),
        despesaPendente: centavosParaReais(despesaPendenteCent),
        // Resultado = tudo que entrou (recebido) menos tudo que saiu (pago).
        resultado: centavosParaReais(receitaRecebidaCent - despesaPagaCent),
      },
      fluxo,
      despesasPorCategoria,
    };
  }
}
