import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateDespesaDto,
  UpdateDespesaDto,
  UploadBoletoDespesaDto,
  PrioridadeDespesa,
} from './dto/despesa.dto';
import { CreateBaixaDto } from './dto/baixa.dto';
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
  valorPago: number;
  saldoDevedor: number;
  pago: boolean;
  dataPagamento: string | null;
  projeto: string | null;
  observacoes: string | null;
  prioridade: PrioridadeDespesa | null;
  boletoNome: string | null;
  boletoEm: string | null;
}

export interface BaixaApi {
  id: string;
  data: string;
  valor: number;
  formaPagamento: string;
  observacao: string | null;
}

// Um lançamento individual de fluxo de caixa (entrada ou saída já realizada).
export interface FluxoCaixaLancamento {
  id: string;
  data: string;
  tipo: 'entrada' | 'saida';
  origem: string;
  descricao: string;
  categoria: string;
  valor: number;
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

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
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
    valorPagoCentavos: number;
    pago: boolean;
    dataPagamento: Date | null;
    projeto: string | null;
    observacoes: string | null;
    prioridade: string | null;
    boletoNome: string | null;
    boletoEm: Date | null;
  }): DespesaApi {
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
      projeto: d.projeto,
      observacoes: d.observacoes,
      prioridade: (d.prioridade as PrioridadeDespesa) ?? null,
      boletoNome: d.boletoNome,
      boletoEm: dataParaIso(d.boletoEm),
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
        valorPagoCentavos: reaisParaCentavos(dto.valorPago ?? 0),
        pago: dto.pago ?? false,
        dataPagamento: dto.dataPagamento ? isoParaData(dto.dataPagamento) : null,
        projeto: dto.projeto ?? null,
        observacoes: dto.observacoes ?? null,
        prioridade: dto.prioridade ?? null,
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
    if (dto.valorPago !== undefined)
      data.valorPagoCentavos = reaisParaCentavos(dto.valorPago);
    if (dto.pago !== undefined) data.pago = dto.pago;
    if (dto.dataPagamento !== undefined)
      data.dataPagamento = dto.dataPagamento
        ? isoParaData(dto.dataPagamento)
        : null;
    if (dto.projeto !== undefined) data.projeto = dto.projeto ?? null;
    if (dto.observacoes !== undefined)
      data.observacoes = dto.observacoes ?? null;
    if (dto.prioridade !== undefined) data.prioridade = dto.prioridade ?? null;

    const d = await this.prisma.despesa.update({ where: { id }, data });
    return this.toApi(d);
  }

  // ===== Boleto (upload/download) =====
  // Mesmo padrão do contrato assinado em Proposta: arquivo salvo como base64
  // em texto no próprio registro, servido de volta como binário.
  async uploadBoleto(id: string, dto: UploadBoletoDespesaDto) {
    await this.ensure(id);
    const base64 = (dto.arquivoBase64 || '').trim();
    if (!base64) throw new NotFoundException('Arquivo não enviado.');
    const conteudo = base64.includes(',') ? base64.split(',').pop()! : base64;
    const d = await this.prisma.despesa.update({
      where: { id },
      data: {
        boletoArquivo: conteudo,
        boletoNome: (dto.nome || '').trim() || 'boleto.pdf',
        boletoEm: new Date(),
      },
    });
    return this.toApi(d);
  }

  async getBoleto(id: string): Promise<{ buffer: Buffer; nome: string }> {
    const d = await this.prisma.despesa.findUnique({
      where: { id },
      select: { boletoArquivo: true, boletoNome: true },
    });
    if (!d || !d.boletoArquivo)
      throw new NotFoundException('Boleto não encontrado.');
    return {
      buffer: Buffer.from(d.boletoArquivo, 'base64'),
      nome: d.boletoNome ?? 'boleto.pdf',
    };
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

  // ===== Baixas (pagamento total ou parcial, com histórico) =====
  async listarBaixas(despesaId: string): Promise<BaixaApi[]> {
    await this.ensure(despesaId);
    const baixas = await this.prisma.baixaDespesa.findMany({
      where: { despesaId },
      orderBy: { data: 'asc' },
    });
    return baixas.map((b) => this.toBaixaApi(b));
  }

  async registrarBaixa(
    despesaId: string,
    dto: CreateBaixaDto,
  ): Promise<DespesaApi> {
    const despesa = await this.ensure(despesaId);
    const valorCentavos = reaisParaCentavos(dto.valor);

    const atualizada = await this.prisma.$transaction(async (tx) => {
      await tx.baixaDespesa.create({
        data: {
          despesaId,
          data: isoParaData(dto.data),
          valorCentavos,
          formaPagamento: dto.formaPagamento,
          observacao: dto.observacao ?? null,
        },
      });
      const agg = await tx.baixaDespesa.aggregate({
        where: { despesaId },
        _sum: { valorCentavos: true },
      });
      const totalPago = agg._sum.valorCentavos ?? 0;
      const quitada = totalPago >= despesa.valorCentavos;
      return tx.despesa.update({
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

    return this.toApi(atualizada);
  }

  async removerBaixa(despesaId: string, baixaId: string): Promise<DespesaApi> {
    await this.ensure(despesaId);
    const baixa = await this.prisma.baixaDespesa.findUnique({
      where: { id: baixaId },
    });
    if (!baixa || baixa.despesaId !== despesaId) {
      throw new NotFoundException('Baixa não encontrada para esta despesa.');
    }

    const atualizada = await this.prisma.$transaction(async (tx) => {
      await tx.baixaDespesa.delete({ where: { id: baixaId } });
      const agg = await tx.baixaDespesa.aggregate({
        where: { despesaId },
        _sum: { valorCentavos: true },
      });
      const totalPago = agg._sum.valorCentavos ?? 0;
      const d = await tx.despesa.findUniqueOrThrow({ where: { id: despesaId } });
      return tx.despesa.update({
        where: { id: despesaId },
        data: {
          valorPagoCentavos: totalPago,
          pago: totalPago >= d.valorCentavos && totalPago > 0,
        },
      });
    });

    return this.toApi(atualizada);
  }

  // ===== Fluxo de Caixa (planilha) =====
  // Lista TODOS os lançamentos individuais já realizados (dinheiro que
  // efetivamente entrou ou saiu) — uma linha por transação, não agregado
  // por período. O agrupamento/filtro por dia, semana, mês ou ano é feito
  // no frontend a partir dessa lista completa.
  //
  // Diferente de resumo() (que trata cada Orçamento/Proposta como um único
  // valor, usando só o status_pago do documento inteiro), aqui cada
  // parcela/mensalidade paga entra como seu próprio lançamento, na data em
  // que foi de fato paga (pagoEm) — essencial agora que orçamentos
  // parcelados e contratos com mensalidades (ParcelaContrato) podem ter
  // algumas parcelas pagas e outras não. Despesas e recebíveis avulsos
  // entram uma linha por BAIXA (permite pagamento parcial datado).
  async fluxoCaixa(): Promise<FluxoCaixaLancamento[]> {
    const [orcamentos, propostas, baixasRecebivel, baixasDespesa] =
      await Promise.all([
        this.prisma.orcamento.findMany({
          where: { statusCancelado: false },
          select: {
            numero: true,
            data: true,
            clienteNomeSnap: true,
            totalCentavos: true,
            totalManualCentavos: true,
            statusPago: true,
            dataPagamento: true,
            parcelas: {
              select: {
                numero: true,
                valorCentavos: true,
                pago: true,
                pagoEm: true,
                dataVencimento: true,
              },
            },
          },
        }),
        this.prisma.proposta.findMany({
          where: { statusCancelado: false },
          select: {
            numero: true,
            data: true,
            clienteNomeSnap: true,
            tipoContrato: true,
            totalCentavos: true,
            totalManualCentavos: true,
            statusPago: true,
            dataPagamento: true,
            parcelasContrato: {
              select: {
                numero: true,
                valorCentavos: true,
                pago: true,
                pagoEm: true,
                dataVencimento: true,
              },
            },
          },
        }),
        this.prisma.baixaRecebivel.findMany({
          include: { recebivel: { select: { empresa: true, descricao: true } } },
        }),
        this.prisma.baixaDespesa.findMany({
          include: {
            despesa: { select: { fornecedor: true, categoria: true, descricao: true } },
          },
        }),
      ]);

    const totalEfetivo = (r: {
      totalCentavos: number;
      totalManualCentavos: number | null;
    }) => r.totalManualCentavos ?? r.totalCentavos ?? 0;

    const lancamentos: FluxoCaixaLancamento[] = [];

    // ----- Entradas: Orçamentos -----
    for (const o of orcamentos) {
      if (o.parcelas.length > 0) {
        for (const p of o.parcelas) {
          if (!p.pago) continue;
          lancamentos.push({
            id: `orc-${o.numero}-p${p.numero}`,
            data: dataParaIso(p.pagoEm ?? p.dataVencimento ?? o.data) as string,
            tipo: 'entrada',
            origem: o.clienteNomeSnap || '—',
            descricao: `${o.numero} · parcela ${p.numero}/${o.parcelas.length}`,
            categoria: 'Orçamento',
            valor: centavosParaReais(p.valorCentavos),
          });
        }
      } else if (o.statusPago) {
        lancamentos.push({
          id: `orc-${o.numero}`,
          data: dataParaIso(o.dataPagamento ?? o.data) as string,
          tipo: 'entrada',
          origem: o.clienteNomeSnap || '—',
          descricao: o.numero,
          categoria: 'Orçamento',
          valor: centavosParaReais(totalEfetivo(o)),
        });
      }
    }

    // ----- Entradas: Propostas (contratos) -----
    for (const p of propostas) {
      if (p.parcelasContrato.length > 0) {
        for (const pc of p.parcelasContrato) {
          if (!pc.pago) continue;
          lancamentos.push({
            id: `prop-${p.numero}-p${pc.numero}`,
            data: dataParaIso(pc.pagoEm ?? pc.dataVencimento ?? p.data) as string,
            tipo: 'entrada',
            origem: p.clienteNomeSnap || '—',
            descricao: `${p.numero} · mensalidade ${pc.numero}/${p.parcelasContrato.length}`,
            categoria: p.tipoContrato || 'Contrato',
            valor: centavosParaReais(pc.valorCentavos),
          });
        }
      } else if (p.statusPago) {
        lancamentos.push({
          id: `prop-${p.numero}`,
          data: dataParaIso(p.dataPagamento ?? p.data) as string,
          tipo: 'entrada',
          origem: p.clienteNomeSnap || '—',
          descricao: p.numero,
          categoria: p.tipoContrato || 'Contrato',
          valor: centavosParaReais(totalEfetivo(p)),
        });
      }
    }

    // ----- Entradas: Recebíveis avulsos (uma linha por baixa registrada) -----
    for (const b of baixasRecebivel) {
      lancamentos.push({
        id: `rec-baixa-${b.id}`,
        data: dataParaIso(b.data) as string,
        tipo: 'entrada',
        origem: b.recebivel.empresa || '—',
        descricao: b.recebivel.descricao || 'Recebível avulso',
        categoria: 'Avulso',
        valor: centavosParaReais(b.valorCentavos),
      });
    }

    // ----- Saídas: Despesas (uma linha por baixa registrada) -----
    for (const b of baixasDespesa) {
      lancamentos.push({
        id: `desp-baixa-${b.id}`,
        data: dataParaIso(b.data) as string,
        tipo: 'saida',
        origem: b.despesa.fornecedor,
        descricao: b.despesa.descricao || b.despesa.fornecedor,
        categoria: b.despesa.categoria || 'Sem categoria',
        valor: centavosParaReais(b.valorCentavos),
      });
    }

    return lancamentos.sort((a, b) => a.data.localeCompare(b.data));
  }

  // ===== Resumo financeiro (Dashboard + Fluxo de Caixa) =====
  // Cruza as saídas (Despesas) com as entradas (orçamentos/propostas pagos e
  // recebíveis avulsos) e devolve KPIs consolidados + série mensal + contas
  // a pagar/receber + inadimplência + atividade recente.
  async resumo() {
    const hoje = hojeIso();
    const [despesas, orcamentos, propostas, recebiveis, baixasDespesa, baixasRecebivel] =
      await Promise.all([
        this.prisma.despesa.findMany({
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
        this.prisma.orcamento.findMany({
          select: {
            numero: true,
            clienteNomeSnap: true,
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
            numero: true,
            clienteNomeSnap: true,
            totalCentavos: true,
            totalManualCentavos: true,
            statusPago: true,
            statusCancelado: true,
            dataPagamento: true,
            createdAt: true,
          },
        }),
        this.prisma.recebivel.findMany({
          select: {
            id: true,
            empresa: true,
            dataPagamento: true,
            valorCentavos: true,
            valorPagoCentavos: true,
            pago: true,
          },
        }),
        this.prisma.baixaDespesa.findMany({
          select: { data: true, valorCentavos: true },
        }),
        this.prisma.baixaRecebivel.findMany({
          select: { data: true, valorCentavos: true },
        }),
      ]);

    // Total efetivo = total manual quando informado, senão o total calculado.
    const totalEfetivo = (r: {
      totalCentavos: number;
      totalManualCentavos: number | null;
    }) => r.totalManualCentavos ?? r.totalCentavos ?? 0;

    // ----- Totais de saída (despesas) — conta pagamento parcial já feito -----
    const despesaTotalCent = despesas.reduce((s, d) => s + d.valorCentavos, 0);
    const despesaPagaCent = despesas.reduce(
      (s, d) => s + (d.pago ? d.valorCentavos : d.valorPagoCentavos),
      0,
    );
    const despesaPendenteCent = despesaTotalCent - despesaPagaCent;

    // ----- Totais de entrada: orçamentos + propostas (documento inteiro) + recebíveis avulsos (parcial) -----
    const orcRecebidoCent = orcamentos
      .filter((o) => o.statusPago && !o.statusCancelado)
      .reduce((s, o) => s + totalEfetivo(o), 0);
    const propRecebidoCent = propostas
      .filter((p) => p.statusPago && !p.statusCancelado)
      .reduce((s, p) => s + totalEfetivo(p), 0);
    const recRecebidoCent = recebiveis.reduce(
      (s, r) => s + (r.pago ? r.valorCentavos : r.valorPagoCentavos),
      0,
    );
    const receitaRecebidaCent = orcRecebidoCent + propRecebidoCent + recRecebidoCent;

    const orcAbertoCent = orcamentos
      .filter((o) => !o.statusPago && !o.statusCancelado)
      .reduce((s, o) => s + totalEfetivo(o), 0);
    const propAbertoCent = propostas
      .filter((p) => !p.statusPago && !p.statusCancelado)
      .reduce((s, p) => s + totalEfetivo(p), 0);
    const recAbertoCent = recebiveis.reduce(
      (s, r) => s + (r.valorCentavos - (r.pago ? r.valorCentavos : r.valorPagoCentavos)),
      0,
    );
    const receitaAbertaCent = orcAbertoCent + propAbertoCent + recAbertoCent;

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
      // Recebíveis avulsos e despesas usam a data de cada BAIXA (permite
      // pagamento parcial datado, em vez de um único "dataPagamento").
      const entradaRec = baixasRecebivel
        .filter((b) => chaveMes(b.data) === mes)
        .reduce((s, b) => s + b.valorCentavos, 0);
      const saida = baixasDespesa
        .filter((b) => chaveMes(b.data) === mes)
        .reduce((s, b) => s + b.valorCentavos, 0);

      const entradaCent = entradaOrc + entradaProp + entradaRec;
      return {
        mes,
        entrada: centavosParaReais(entradaCent),
        saida: centavosParaReais(saida),
        saldo: centavosParaReais(entradaCent - saida),
      };
    });

    // Saldo acumulado: soma corrida do saldo mensal (não é saldo bancário
    // real — o sistema não tem conceito de conta/saldo inicial — é apenas o
    // acumulado de entradas menos saídas desde o início dos 12 meses acima).
    let acumulado = 0;
    const saldoAcumulado = fluxo.map((f) => {
      acumulado += f.saldo;
      return { mes: f.mes, saldo: Number(acumulado.toFixed(2)) };
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

    // ----- Contas a Pagar (snapshot para o Dashboard) -----
    const despesaAtrasadaCent = despesas
      .filter((d) => !d.pago && dataParaIso(d.dataPagamento ?? d.data)! < hoje)
      .reduce((s, d) => s + (d.valorCentavos - d.valorPagoCentavos), 0);
    const contasAPagar = {
      total: centavosParaReais(despesaTotalCent),
      aPagar: centavosParaReais(despesaPendenteCent),
      atrasado: centavosParaReais(despesaAtrasadaCent),
    };
    const proximosVencimentos = despesas
      .filter((d) => !d.pago)
      .map((d) => ({
        nome: d.fornecedor,
        valor: centavosParaReais(d.valorCentavos - d.valorPagoCentavos),
        data: dataParaIso(d.dataPagamento ?? d.data) as string,
      }))
      .sort((a, b) => a.data.localeCompare(b.data))
      .slice(0, 5);

    // ----- Contas a Receber + inadimplência por prazo (aging) -----
    type Aberto = { nome: string; valor: number; vencimento: string | null };
    const abertosOrc: Aberto[] = orcamentos
      .filter((o) => !o.statusPago && !o.statusCancelado)
      .map((o) => ({
        nome: o.clienteNomeSnap || o.numero,
        valor: totalEfetivo(o),
        vencimento: dataParaIso(o.dataPagamento),
      }));
    const abertosProp: Aberto[] = propostas
      .filter((p) => !p.statusPago && !p.statusCancelado)
      .map((p) => ({
        nome: p.clienteNomeSnap || p.numero,
        valor: totalEfetivo(p),
        vencimento: dataParaIso(p.dataPagamento),
      }));
    const abertosRec: Aberto[] = recebiveis
      .filter((r) => !r.pago || r.valorPagoCentavos < r.valorCentavos)
      .map((r) => ({
        nome: r.empresa,
        valor: r.valorCentavos - r.valorPagoCentavos,
        vencimento: dataParaIso(r.dataPagamento),
      }));
    const todosAbertos = [...abertosOrc, ...abertosProp, ...abertosRec];

    const diasAtraso = (vencimento: string | null): number => {
      if (!vencimento) return -1; // sem data prevista: não entra na inadimplência
      const ms = new Date(hoje).getTime() - new Date(vencimento).getTime();
      return Math.floor(ms / 86_400_000);
    };

    const buckets = { emDia: 0, ate15: 0, ate30: 0, mais30: 0 };
    for (const a of todosAbertos) {
      const dias = diasAtraso(a.vencimento);
      if (dias < 0) buckets.emDia += a.valor;
      else if (dias <= 15) buckets.ate15 += a.valor;
      else if (dias <= 30) buckets.ate30 += a.valor;
      else buckets.mais30 += a.valor;
    }
    const agingRecebiveis = {
      emDia: centavosParaReais(buckets.emDia),
      ate15Dias: centavosParaReais(buckets.ate15),
      ate30Dias: centavosParaReais(buckets.ate30),
      mais30Dias: centavosParaReais(buckets.mais30),
    };
    const maioresAtrasos = todosAbertos
      .map((a) => ({ ...a, dias: diasAtraso(a.vencimento) }))
      .filter((a) => a.dias > 0)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5)
      .map((a) => ({ nome: a.nome, valor: centavosParaReais(a.valor), dias: a.dias }));

    const contasAReceber = {
      total: centavosParaReais(receitaRecebidaCent + receitaAbertaCent),
      aReceber: centavosParaReais(receitaAbertaCent),
      atrasado: centavosParaReais(buckets.ate15 + buckets.ate30 + buckets.mais30),
    };

    // ----- Atividade recente: últimas baixas (despesa + recebível) -----
    const [ultimasBaixasDespesa, ultimasBaixasRecebivel] = await Promise.all([
      this.prisma.baixaDespesa.findMany({
        orderBy: { data: 'desc' },
        take: 8,
        include: { despesa: { select: { fornecedor: true } } },
      }),
      this.prisma.baixaRecebivel.findMany({
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
        // Resultado = tudo que entrou (recebido) menos tudo que saiu (pago).
        resultado: centavosParaReais(receitaRecebidaCent - despesaPagaCent),
      },
      fluxo,
      saldoAcumulado,
      despesasPorCategoria,
      contasAPagar,
      contasAReceber,
      agingRecebiveis,
      proximosVencimentos,
      maioresAtrasos,
      atividadeRecente,
    };
  }
}
