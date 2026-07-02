import { Injectable, NotFoundException, forwardRef, Inject } from '@nestjs/common';
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
import { OrdensServicoService } from '../ordens-servico/ordens-servico.service';

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
    // forwardRef evita dependência circular entre os módulos
    @Inject(forwardRef(() => OrdensServicoService))
    private ordensServico: OrdensServicoService,
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

      // Dados de cadastro vindos do formulário. Só sobrescrevem o que veio
      // preenchido — assim não apagamos um dado salvo se o campo vier vazio.
      const dadosCadastro = {
        nome: dto.empresa || cliente?.nome || 'Cliente sem nome',
        cep: dto.cep ?? cliente?.cep ?? null,
        endereco: dto.endereco ?? cliente?.endereco ?? null,
        numero: dto.enderecoNumero ?? cliente?.numero ?? null,
        complemento: dto.complemento ?? cliente?.complemento ?? null,
        bairro: dto.bairro ?? cliente?.bairro ?? null,
        cidade: dto.cidade ?? cliente?.cidade ?? null,
        estado: dto.estado ?? cliente?.estado ?? null,
        pais: dto.pais || cliente?.pais || 'Brasil',
      };

      if (!cliente) {
        // Primeiro orçamento desse CNPJ: cria o cadastro do cliente.
        cliente = await this.prisma.cliente.create({
          data: { cnpj: cnpj || null, ...dadosCadastro },
        });
      } else {
        // Já existe: mantém o cadastro atualizado com os dados mais recentes
        // informados na emissão (endereço, número, complemento etc.).
        cliente = await this.prisma.cliente.update({
          where: { id: cliente.id },
          data: dadosCadastro,
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

    // Total manual (override): quando informado (> 0), passa a valer como
    // total efetivo do orçamento, preservando subtotal/desconto calculados
    // apenas como referência. As parcelas passam a somar o total manual.
    const temManual =
      dto.totalManual !== undefined &&
      dto.totalManual !== null &&
      Number(dto.totalManual) > 0;
    const totalManualCentavos = temManual
      ? reaisParaCentavos(dto.totalManual)
      : null;
    const totalEfetivoCentavos = totalManualCentavos ?? totais.totalCentavos;

    const parcelasEntrada: ParcelaCalc[] = (dto.parcelas || []).map((p) => ({
      numero: p.numero,
      data: p.data || '',
      valorCentavos: reaisParaCentavos(p.valor),
      pago: p.pago,
    }));
    const parcelas = normalizarParcelas(
      parcelasEntrada,
      dto.numParcelas || 1,
      totalEfetivoCentavos,
    );

    return { totais, parcelas, itensCalc, totalManualCentavos };
  }

  // ===== Criar =====
  async create(dto: CreateOrcamentoDto, userId?: string) {
    const numero = dto.numero?.trim() || (await this.proximoNumero());
    const { clienteId, contatoId } = await this.resolverCliente(dto);
    const { totais, parcelas, totalManualCentavos } = this.montarDados(dto);

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
        // total efetivo = manual (override) quando houver, senão o calculado
        totalCentavos: totalManualCentavos ?? totais.totalCentavos,
        totalManualCentavos,
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
    const atual = await this.ensure(id);
    const { totais, parcelas, totalManualCentavos } = this.montarDados(dto);

    const orc = await this.prisma.$transaction(async (tx) => {
      // remove filhos e recria (estratégia simples e previsível)
      await tx.itemOrcamento.deleteMany({ where: { orcamentoId: id } });
      await tx.parcela.deleteMany({ where: { orcamentoId: id } });

      // Mantém o cadastro do cliente vinculado atualizado com os dados de
      // endereço mais recentes (endereço, número, complemento etc.) — assim
      // o autocompletar por CNPJ sempre reflete a última edição.
      if (atual?.clienteId) {
        await tx.cliente.update({
          where: { id: atual.clienteId },
          data: {
            ...(dto.empresa ? { nome: dto.empresa } : {}),
            ...(dto.cep !== undefined ? { cep: dto.cep } : {}),
            ...(dto.endereco !== undefined ? { endereco: dto.endereco } : {}),
            ...(dto.enderecoNumero !== undefined
              ? { numero: dto.enderecoNumero }
              : {}),
            ...(dto.complemento !== undefined
              ? { complemento: dto.complemento }
              : {}),
            ...(dto.bairro !== undefined ? { bairro: dto.bairro } : {}),
            ...(dto.cidade !== undefined ? { cidade: dto.cidade } : {}),
            ...(dto.estado !== undefined ? { estado: dto.estado } : {}),
            ...(dto.pais ? { pais: dto.pais } : {}),
          },
        });
      }

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
          totalManualCentavos,
          subtotalCentavos: totais.subtotalCentavos,
          descontoCentavos: totais.descontoCentavos,
          // total efetivo = manual (override) quando houver, senão o calculado
          totalCentavos: totalManualCentavos ?? totais.totalCentavos,
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

    // Cria a OS automaticamente se o orçamento foi aprovado
    if ((orc as any).statusAprovado) {
      this.ordensServico.criarAPartirDoOrcamento(id).catch(() => {
        // Não bloqueia a resposta — idempotente
      });
    }

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
    if (dto.reprovado !== undefined) data.statusReprovado = dto.reprovado;

    const orc = await this.prisma.orcamento.update({
      where: { id },
      data,
      include: ORC_INCLUDE,
    });

    // Cria a OS automaticamente na primeira vez que o orçamento for aprovado
    if (orc.statusAprovado) {
      this.ordensServico.criarAPartirDoOrcamento(id).catch(() => {
        // Não bloqueia a resposta do status — a OS pode ser criada depois
      });
    }

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
        reprovado: 'statusReprovado',
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

  // ===== Buscar por número exato (case-insensitive) =====
  async buscarPorNumero(numero: string) {
    const alvo = (numero || '').trim();
    if (!alvo) throw new NotFoundException('Orçamento não encontrado');
    const orc = await this.prisma.orcamento.findFirst({
      where: { numero: { equals: alvo, mode: 'insensitive' } },
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
    return o;
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
      enderecoNumero: o.cliente?.numero ?? '',
      complemento: o.cliente?.complemento ?? '',
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
      // total manual (override): null quando não houver. Em reais.
      totalManual:
        o.totalManualCentavos != null
          ? centavosParaReais(o.totalManualCentavos)
          : null,
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
      reprovado: o.statusReprovado ?? false,
      // quando foi enviado (usado na coluna "Enviado" do Controle)
      enviadoEm: o.enviadoEm ? new Date(o.enviadoEm).toISOString() : null,
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
