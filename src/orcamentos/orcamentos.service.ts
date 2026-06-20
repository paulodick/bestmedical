import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateOrcamentoDto,
  UpdateOrcamentoDto,
} from './dto/orcamento.dto';
import {
  ListarOrcamentosDto,
  UpdateStatusDto,
} from './dto/listar-orcamentos.dto';
import { Paginated } from '../common/dto/pagination.dto';
import {
  calcTotais,
  centavosParaReais,
  normalizarParcelas,
  reaisParaCentavos,
  ParcelaCalc,
} from './orcamento.calc';
import { PdfService } from './pdf/pdf.service';
import { EmailService } from '../email/email.service';
import { montarEmailOrcamento } from '../email/email.template';

const TEXTO_FINAL_PADRAO =
  'Orçamento válido por 15 dias. Qualquer alteração no escopo do serviço poderá alterar os itens e/ou valores listados nesta proposta.';

// include padrão para trazer itens e parcelas ordenados
const ORC_INCLUDE = {
  itens: { orderBy: { ordem: 'asc' } },
  parcelas: { orderBy: { numero: 'asc' } },
  cliente: true,
  contato: true,
} satisfies Prisma.OrcamentoInclude;

@Injectable()
export class OrcamentosService {
  constructor(
    private prisma: PrismaService,
    private pdf: PdfService,
    private email: EmailService,
  ) {}

  // ===== Próximo número: ORC-{ano}-{seq} =====
  async proximoNumero(): Promise<string> {
    const ano = new Date().getFullYear();
    const prefixo = `ORC-${ano}-`;
    const ultimos = await this.prisma.orcamento.findMany({
      where: { numero: { startsWith: prefixo } },
      select: { numero: true },
    });
    const max = ultimos.reduce((acc, o) => {
      const n = parseInt(o.numero.split('-')[2] || '0', 10);
      return isNaN(n) ? acc : Math.max(acc, n);
    }, 0);
    return `${prefixo}${String(max + 1).padStart(4, '0')}`;
  }

  // ===== Resolve cliente: usa clienteId ou cria/atualiza a partir dos campos =====
  private async resolverCliente(
    dto: CreateOrcamentoDto,
  ): Promise<{ clienteId: string; contatoId?: string }> {
    let clienteId = dto.clienteId;

    if (!clienteId) {
      // tenta achar por CNPJ; senão cria novo (nome pode ser vazio no MVP)
      const cnpj = dto.cnpj?.trim();
      let cliente = cnpj
        ? await this.prisma.cliente.findUnique({ where: { cnpj } })
        : null;

      if (!cliente) {
        cliente = await this.prisma.cliente.create({
          data: {
            cnpj: cnpj || null,
            nome: dto.empresa || 'Cliente sem nome',
            cep: dto.cep,
            endereco: dto.endereco,
            bairro: dto.bairro,
            cidade: dto.cidade,
            estado: dto.estado,
            pais: dto.pais || 'Brasil',
          },
        });
      }
      clienteId = cliente.id;
    }

    // contato (solicitante)
    let contatoId = dto.contatoId;
    if (!contatoId && dto.solicitante) {
      const contato = await this.prisma.contato.create({
        data: {
          clienteId,
          nome: dto.solicitante,
          setor: dto.setor,
          telefone: dto.telefone,
          email: dto.email,
        },
      });
      contatoId = contato.id;
    }

    return { clienteId, contatoId };
  }

  // ===== Monta o payload de dados do orçamento (cálculos oficiais) =====
  private montarDados(dto: CreateOrcamentoDto) {
    const itensCalc = (dto.itens || []).map((it) => ({
      quantidade: it.quantidade || 1,
      valorItemCentavos: reaisParaCentavos(it.valorItem),
    }));
    const totais = calcTotais(itensCalc, dto.descontoPercent || 0);

    const parcelasEntrada: ParcelaCalc[] = (dto.parcelas || []).map((p) => ({
      numero: p.numero,
      data: p.data || '',
      valorCentavos: reaisParaCentavos(p.valor),
      pago: p.pago,
    }));
    const parcelas = normalizarParcelas(
      parcelasEntrada,
      dto.numParcelas || 1,
      totais.totalCentavos,
    );

    return { totais, parcelas, itensCalc };
  }

  // ===== Criar =====
  async create(dto: CreateOrcamentoDto, userId?: string) {
    const numero = dto.numero?.trim() || (await this.proximoNumero());
    const { clienteId, contatoId } = await this.resolverCliente(dto);
    const { totais, parcelas } = this.montarDados(dto);

    const orc = await this.prisma.orcamento.create({
      data: {
        numero,
        data: dto.data ? new Date(dto.data) : new Date(),
        clienteId,
        contatoId,
        criadoPor: userId,
        // snapshot
        clienteNomeSnap: dto.empresa,
        clienteCnpjSnap: dto.cnpj,
        solicitanteSnap: dto.solicitante,
        setorSnap: dto.setor,
        telefoneSnap: dto.telefone,
        emailSnap: dto.email,
        // técnicos
        modalidade: dto.modalidade,
        marca: dto.marca,
        marcaOutras: dto.marca === 'Outras' ? dto.marcaOutras : null,
        modelo: dto.modelo,
        numeroSerie: dto.numeroSerie,
        descricaoVisita: dto.descricaoVisita,
        // resumo
        descontoPercent: dto.descontoPercent || 0,
        numParcelas: dto.numParcelas || 1,
        subtotalCentavos: totais.subtotalCentavos,
        descontoCentavos: totais.descontoCentavos,
        totalCentavos: totais.totalCentavos,
        // finalização
        observacoes: dto.observacoes,
        textoFinal: dto.textoFinal ?? TEXTO_FINAL_PADRAO,
        // status
        statusEnviado: !!dto.enviado,
        statusAprovado: !!dto.aprovado,
        statusRealizado: !!dto.realizado,
        statusAguardandoPeca: !!dto.aguardandoPeca,
        statusOrdemServico: !!dto.ordemServico,
        statusPagamentoRealizado: !!dto.pagamentoRealizado,
        // listas
        itens: {
          create: (dto.itens || []).map((it, i) => ({
            ordem: i,
            codigo: it.codigo || '',
            descricao: it.descricao || '',
            quantidade: it.quantidade || 1,
            valorItemCentavos: reaisParaCentavos(it.valorItem),
          })),
        },
        parcelas: {
          create: parcelas.map((p) => ({
            numero: p.numero,
            dataVencimento: p.data ? new Date(p.data) : null,
            valorCentavos: p.valorCentavos,
            pago: !!p.pago,
          })),
        },
      },
      include: ORC_INCLUDE,
    });

    return this.serialize(orc);
  }

  // ===== Atualizar (substitui itens e parcelas) =====
  async update(id: string, dto: UpdateOrcamentoDto) {
    await this.ensure(id);
    const { totais, parcelas } = this.montarDados(dto);

    const orc = await this.prisma.$transaction(async (tx) => {
      // remove filhos e recria (estratégia simples e previsível)
      await tx.itemOrcamento.deleteMany({ where: { orcamentoId: id } });
      await tx.parcela.deleteMany({ where: { orcamentoId: id } });

      return tx.orcamento.update({
        where: { id },
        data: {
          ...(dto.numero ? { numero: dto.numero } : {}),
          ...(dto.data ? { data: new Date(dto.data) } : {}),
          clienteNomeSnap: dto.empresa,
          clienteCnpjSnap: dto.cnpj,
          solicitanteSnap: dto.solicitante,
          setorSnap: dto.setor,
          telefoneSnap: dto.telefone,
          emailSnap: dto.email,
          modalidade: dto.modalidade,
          marca: dto.marca,
          marcaOutras: dto.marca === 'Outras' ? dto.marcaOutras : null,
          modelo: dto.modelo,
          numeroSerie: dto.numeroSerie,
          descricaoVisita: dto.descricaoVisita,
          descontoPercent: dto.descontoPercent ?? 0,
          numParcelas: dto.numParcelas ?? 1,
          subtotalCentavos: totais.subtotalCentavos,
          descontoCentavos: totais.descontoCentavos,
          totalCentavos: totais.totalCentavos,
          observacoes: dto.observacoes,
          textoFinal: dto.textoFinal ?? TEXTO_FINAL_PADRAO,
          statusEnviado: !!dto.enviado,
          statusAprovado: !!dto.aprovado,
          statusRealizado: !!dto.realizado,
          statusAguardandoPeca: !!dto.aguardandoPeca,
          statusOrdemServico: !!dto.ordemServico,
          statusPagamentoRealizado: !!dto.pagamentoRealizado,
          itens: {
            create: (dto.itens || []).map((it, i) => ({
              ordem: i,
              codigo: it.codigo || '',
              descricao: it.descricao || '',
              quantidade: it.quantidade || 1,
              valorItemCentavos: reaisParaCentavos(it.valorItem),
            })),
          },
          parcelas: {
            create: parcelas.map((p) => ({
              numero: p.numero,
              dataVencimento: p.data ? new Date(p.data) : null,
              valorCentavos: p.valorCentavos,
              pago: !!p.pago,
            })),
          },
        },
        include: ORC_INCLUDE,
      });
    });

    return this.serialize(orc);
  }

  // ===== Atualizar somente status (dropdown inline) =====
  async updateStatus(id: string, dto: UpdateStatusDto) {
    await this.ensure(id);
    const data: Prisma.OrcamentoUpdateInput = {};
    if (dto.enviado !== undefined) {
      data.statusEnviado = dto.enviado;
      if (dto.enviado) data.enviadoEm = new Date();
    }
    if (dto.aprovado !== undefined) data.statusAprovado = dto.aprovado;
    if (dto.realizado !== undefined) data.statusRealizado = dto.realizado;
    if (dto.aguardandoPeca !== undefined)
      data.statusAguardandoPeca = dto.aguardandoPeca;
    if (dto.ordemServico !== undefined)
      data.statusOrdemServico = dto.ordemServico;
    if (dto.pagamentoRealizado !== undefined)
      data.statusPagamentoRealizado = dto.pagamentoRealizado;

    const orc = await this.prisma.orcamento.update({
      where: { id },
      data,
      include: ORC_INCLUDE,
    });
    return this.serialize(orc);
  }

  // ===== Listar com filtros, busca, ordenação e paginação =====
  async list(q: ListarOrcamentosDto): Promise<Paginated<any>> {
    const where: Prisma.OrcamentoWhereInput = {};

    if (q.clienteId) where.clienteId = q.clienteId;
    if (q.cnpj) where.clienteCnpjSnap = { contains: q.cnpj };
    if (q.data) {
      const d = new Date(q.data);
      where.data = d;
    }
    if (q.status) {
      const map: Record<string, keyof Prisma.OrcamentoWhereInput> = {
        enviado: 'statusEnviado',
        aprovado: 'statusAprovado',
        realizado: 'statusRealizado',
        aguardandoPeca: 'statusAguardandoPeca',
        ordemServico: 'statusOrdemServico',
        pagamentoRealizado: 'statusPagamentoRealizado',
      };
      (where as any)[map[q.status]] = true;
    }
    if (q.busca) {
      where.OR = [
        { numero: { contains: q.busca, mode: 'insensitive' } },
        { clienteNomeSnap: { contains: q.busca, mode: 'insensitive' } },
        { clienteCnpjSnap: { contains: q.busca, mode: 'insensitive' } },
        { solicitanteSnap: { contains: q.busca, mode: 'insensitive' } },
        { modalidade: { contains: q.busca, mode: 'insensitive' } },
        { marca: { contains: q.busca, mode: 'insensitive' } },
        { modelo: { contains: q.busca, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.OrcamentoOrderByWithRelationInput =
      q.order === 'data_asc'
        ? { data: 'asc' }
        : q.order === 'numero_desc'
          ? { numero: 'desc' }
          : q.order === 'numero_asc'
            ? { numero: 'asc' }
            : { data: 'desc' }; // padrão: mais recente primeiro

    const [rows, total] = await Promise.all([
      this.prisma.orcamento.findMany({
        where,
        orderBy,
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: ORC_INCLUDE,
      }),
      this.prisma.orcamento.count({ where }),
    ]);

    return {
      data: rows.map((r) => this.serialize(r)),
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.ceil(total / q.pageSize) || 1,
    };
  }

  async get(id: string) {
    const orc = await this.prisma.orcamento.findUnique({
      where: { id },
      include: ORC_INCLUDE,
    });
    if (!orc) throw new NotFoundException('Orçamento não encontrado');
    return this.serialize(orc);
  }

  async remove(id: string) {
    await this.ensure(id);
    await this.prisma.orcamento.delete({ where: { id } });
    return { ok: true };
  }

  // ===== Enviar por e-mail (gera PDF, envia ao solicitante com cópia) =====
  async enviar(id: string) {
    await this.ensure(id);
    const dados = await this.get(id); // serializado (formato do front)

    const destinatario = (dados.email || '').trim();
    if (!destinatario) {
      return {
        ok: false,
        mensagem:
          'O orçamento não tem e-mail do solicitante. Preencha o campo E-mail para enviar.',
      };
    }

    if (!this.email.configurado) {
      return {
        ok: false,
        mensagem:
          'Envio de e-mail ainda não configurado no servidor (SMTP). O orçamento não foi enviado.',
      };
    }

    // Gera o PDF e monta o e-mail
    const pdf = await this.pdf.gerar(dados);
    const { assunto, html } = montarEmailOrcamento(dados);

    try {
      await this.email.enviar({
        para: destinatario,
        assunto,
        html,
        anexoPdf: { nome: `${dados.numero || 'orcamento'}.pdf`, conteudo: pdf },
      });
    } catch (e) {
      return {
        ok: false,
        mensagem:
          'Falha ao enviar o e-mail: ' +
          (e instanceof Error ? e.message : 'erro desconhecido'),
      };
    }

    // Marca como enviado
    const orc = await this.prisma.orcamento.update({
      where: { id },
      data: { statusEnviado: true, enviadoEm: new Date() },
      include: ORC_INCLUDE,
    });

    return {
      ok: true,
      mensagem: `Orçamento enviado para ${destinatario} (cópia para controle).`,
      orcamento: this.serialize(orc),
    };
  }

  private async ensure(id: string) {
    const o = await this.prisma.orcamento.findUnique({ where: { id } });
    if (!o) throw new NotFoundException('Orçamento não encontrado');
  }

  // ===== Serializa para o formato esperado pelo front (reais, ISO, campos planos) =====
  private serialize(o: any) {
    const isoDate = (d: Date | null) =>
      d ? new Date(d).toISOString().slice(0, 10) : '';
    return {
      id: o.id,
      numero: o.numero,
      data: isoDate(o.data),
      // empresa / endereço (snapshot tem prioridade; cai para o cadastro)
      cnpj: o.clienteCnpjSnap ?? o.cliente?.cnpj ?? '',
      empresa: o.clienteNomeSnap ?? o.cliente?.nome ?? '',
      cep: o.cliente?.cep ?? '',
      endereco: o.cliente?.endereco ?? '',
      bairro: o.cliente?.bairro ?? '',
      cidade: o.cliente?.cidade ?? '',
      estado: o.cliente?.estado ?? '',
      pais: o.cliente?.pais ?? 'Brasil',
      // solicitante
      solicitante: o.solicitanteSnap ?? o.contato?.nome ?? '',
      setor: o.setorSnap ?? o.contato?.setor ?? '',
      telefone: o.telefoneSnap ?? o.contato?.telefone ?? '',
      email: o.emailSnap ?? o.contato?.email ?? '',
      // técnicos
      modalidade: o.modalidade ?? '',
      marca: o.marca ?? '',
      marcaOutras: o.marcaOutras ?? '',
      modelo: o.modelo ?? '',
      numeroSerie: o.numeroSerie ?? '',
      descricaoVisita: o.descricaoVisita ?? '',
      // resumo
      descontoPercent: o.descontoPercent ?? 0,
      numParcelas: o.numParcelas ?? 1,
      subtotal: centavosParaReais(o.subtotalCentavos),
      desconto: centavosParaReais(o.descontoCentavos),
      total: centavosParaReais(o.totalCentavos),
      // finalização
      observacoes: o.observacoes ?? '',
      textoFinal: o.textoFinal ?? '',
      // status (nomes iguais aos do front)
      enviado: o.statusEnviado,
      aprovado: o.statusAprovado,
      realizado: o.statusRealizado,
      aguardandoPeca: o.statusAguardandoPeca,
      ordemServico: o.statusOrdemServico,
      pagamentoRealizado: o.statusPagamentoRealizado,
      // listas
      itens: (o.itens || []).map((it: any) => ({
        id: it.id,
        codigo: it.codigo,
        item: it.descricao,
        quantidade: it.quantidade,
        valorItem: centavosParaReais(it.valorItemCentavos),
      })),
      parcelas: (o.parcelas || []).map((p: any) => ({
        id: p.id,
        numero: p.numero,
        data: isoDate(p.dataVencimento),
        valor: centavosParaReais(p.valorCentavos),
        pago: p.pago,
      })),
    };
  }
}
