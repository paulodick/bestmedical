import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateLancamentoPessoalDto,
  UpdateLancamentoPessoalDto,
} from './dto/lancamento-pessoal.dto';
import { PaginationDto, Paginated } from '../common/dto/pagination.dto';
import {
  reaisParaCentavos,
  centavosParaReais,
} from '../orcamentos/orcamento.calc';
import { Prisma } from '@prisma/client';

// Formato do lançamento pessoal exposto ao frontend (valor em reais, datas ISO).
export interface LancamentoPessoalApi {
  id: string;
  data: string;
  tipo: string; // 'receita' | 'despesa'
  pessoa: string;
  categoria: string | null;
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
export class PessoalService {
  constructor(private prisma: PrismaService) {}

  private toApi(l: {
    id: string;
    data: Date;
    tipo: string;
    pessoa: string;
    categoria: string | null;
    descricao: string | null;
    valorCentavos: number;
    pago: boolean;
    dataPagamento: Date | null;
    observacoes: string | null;
  }): LancamentoPessoalApi {
    return {
      id: l.id,
      data: dataParaIso(l.data) as string,
      tipo: l.tipo,
      pessoa: l.pessoa,
      categoria: l.categoria,
      descricao: l.descricao,
      valor: centavosParaReais(l.valorCentavos),
      pago: l.pago,
      dataPagamento: dataParaIso(l.dataPagamento),
      observacoes: l.observacoes,
    };
  }

  async list(q: PaginationDto): Promise<Paginated<LancamentoPessoalApi>> {
    const where: Prisma.LancamentoPessoalWhereInput = q.busca
      ? {
          OR: [
            { pessoa: { contains: q.busca, mode: 'insensitive' } },
            { categoria: { contains: q.busca, mode: 'insensitive' } },
            { descricao: { contains: q.busca, mode: 'insensitive' } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.lancamentoPessoal.findMany({
        where,
        orderBy: [{ data: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.lancamentoPessoal.count({ where }),
    ]);

    return {
      data: data.map((l) => this.toApi(l)),
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.ceil(total / q.pageSize) || 1,
    };
  }

  async create(
    dto: CreateLancamentoPessoalDto,
  ): Promise<LancamentoPessoalApi> {
    const l = await this.prisma.lancamentoPessoal.create({
      data: {
        data: isoParaData(dto.data),
        tipo: dto.tipo,
        pessoa: dto.pessoa,
        categoria: dto.categoria ?? null,
        descricao: dto.descricao ?? null,
        valorCentavos: reaisParaCentavos(dto.valor),
        pago: dto.pago ?? false,
        dataPagamento: dto.dataPagamento ? isoParaData(dto.dataPagamento) : null,
        observacoes: dto.observacoes ?? null,
      },
    });
    return this.toApi(l);
  }

  async update(
    id: string,
    dto: UpdateLancamentoPessoalDto,
  ): Promise<LancamentoPessoalApi> {
    await this.ensure(id);

    const data: Prisma.LancamentoPessoalUpdateInput = {};
    if (dto.data !== undefined) data.data = isoParaData(dto.data);
    if (dto.tipo !== undefined) data.tipo = dto.tipo;
    if (dto.pessoa !== undefined) data.pessoa = dto.pessoa;
    if (dto.categoria !== undefined) data.categoria = dto.categoria ?? null;
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

    const l = await this.prisma.lancamentoPessoal.update({
      where: { id },
      data,
    });
    return this.toApi(l);
  }

  async remove(id: string) {
    await this.ensure(id);
    await this.prisma.lancamentoPessoal.delete({ where: { id } });
    return { ok: true };
  }

  private async ensure(id: string) {
    const l = await this.prisma.lancamentoPessoal.findUnique({
      where: { id },
    });
    if (!l) throw new NotFoundException('Lançamento não encontrado');
    return l;
  }

  // ===== Resumo financeiro pessoal (Dashboard) =====
  // Consolida receitas e despesas pessoais em KPIs, série mensal (fluxo) e
  // despesas por categoria — espelhando o resumo do financeiro da empresa.
  async resumo() {
    const lancamentos = await this.prisma.lancamentoPessoal.findMany({
      select: {
        data: true,
        dataPagamento: true,
        valorCentavos: true,
        pago: true,
        tipo: true,
        categoria: true,
        pessoa: true,
      },
    });

    const receitas = lancamentos.filter((l) => l.tipo === 'receita');
    const despesas = lancamentos.filter((l) => l.tipo === 'despesa');

    // ----- Totais de entrada (receitas) -----
    const receitaTotalCent = receitas.reduce((s, l) => s + l.valorCentavos, 0);
    const receitaRecebidaCent = receitas
      .filter((l) => l.pago)
      .reduce((s, l) => s + l.valorCentavos, 0);
    const receitaAbertaCent = receitaTotalCent - receitaRecebidaCent;

    // ----- Totais de saída (despesas) -----
    const despesaTotalCent = despesas.reduce((s, l) => s + l.valorCentavos, 0);
    const despesaPagaCent = despesas
      .filter((l) => l.pago)
      .reduce((s, l) => s + l.valorCentavos, 0);
    const despesaPendenteCent = despesaTotalCent - despesaPagaCent;

    // ----- Série mensal (Fluxo de Caixa): últimos 12 meses -----
    const meses: string[] = [];
    const agora = new Date();
    for (let i = 11; i >= 0; i--) {
      const dt = new Date(
        Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - i, 1),
      );
      meses.push(dt.toISOString().slice(0, 7));
    }

    const chaveMes = (d: Date | null): string | null =>
      d ? d.toISOString().slice(0, 7) : null;

    const fluxo = meses.map((mes) => {
      const entrada = receitas
        .filter(
          (l) =>
            l.pago && (chaveMes(l.dataPagamento) ?? chaveMes(l.data)) === mes,
        )
        .reduce((s, l) => s + l.valorCentavos, 0);
      const saida = despesas
        .filter(
          (l) =>
            l.pago && (chaveMes(l.dataPagamento) ?? chaveMes(l.data)) === mes,
        )
        .reduce((s, l) => s + l.valorCentavos, 0);
      return {
        mes,
        entrada: centavosParaReais(entrada),
        saida: centavosParaReais(saida),
        saldo: centavosParaReais(entrada - saida),
      };
    });

    // ----- Despesas por categoria -----
    const porCategoriaMap = new Map<string, number>();
    for (const l of despesas) {
      const cat = (l.categoria || 'Sem categoria').trim() || 'Sem categoria';
      porCategoriaMap.set(
        cat,
        (porCategoriaMap.get(cat) ?? 0) + l.valorCentavos,
      );
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
        resultado: centavosParaReais(receitaRecebidaCent - despesaPagaCent),
      },
      fluxo,
      despesasPorCategoria,
    };
  }
}
