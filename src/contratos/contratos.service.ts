import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePropostaDto, UpdatePropostaDto } from './dto/proposta.dto';
import {
  ListarPropostasDto,
  UpdateStatusPropostaDto,
} from './dto/listar-propostas.dto';
import { Paginated } from '../common/dto/pagination.dto';
import {
  calcTotais,
  centavosParaReais,
  reaisParaCentavos,
} from '../orcamentos/orcamento.calc';
import { PropostaPdfService } from './pdf/proposta-pdf.service';
import { EmailService } from '../email/email.service';
import { montarEmailProposta } from './proposta-email.template';
import { gerarObservacoesComCustomizacoes } from './contrato-customizacoes';
import { CONDICOES_PADRAO } from './condicoes-padrao';
import { ContratoService } from './contrato.service';

// CC fixo de controle para o envio da proposta (além do MAIL_CC do servidor)
const CC_FIXO_PROPOSTA = 'paulo@bestmedical.com.br';

const TEXTO_FINAL_PADRAO =
  'Proposta válida por 30 dias. Este documento é uma proposta comercial, não um contrato.';

// include padrão para trazer os equipamentos ordenados + cliente/contato
const PROP_INCLUDE = {
  equipamentos: { orderBy: { ordem: 'asc' } },
  cliente: true,
  contato: true,
} satisfies Prisma.PropostaInclude;

@Injectable()
export class ContratosService {
  constructor(
    private prisma: PrismaService,
    private pdf: PropostaPdfService,
    private email: EmailService,
    private contrato: ContratoService,
  ) {}

  // ===== Próximo número: PC-{ano}-{seq} =====
  async proximoNumero(): Promise<string> {
    const ano = new Date().getFullYear();
    const prefixo = `PC-${ano}-`;
    const ultimos = await this.prisma.proposta.findMany({
      where: { numero: { startsWith: prefixo } },
      select: { numero: true },
    });
    const max = ultimos.reduce((acc, p) => {
      const n = parseInt(p.numero.split('-')[2] || '0', 10);
      return isNaN(n) ? acc : Math.max(acc, n);
    }, 0);
    return `${prefixo}${String(max + 1).padStart(4, '0')}`;
  }

  // ===== Resolve cliente: usa clienteId ou cria/atualiza a partir dos campos =====
  // Mesma lógica do orçamento (autocompletar por CNPJ).
  private async resolverCliente(
    dto: CreatePropostaDto,
  ): Promise<{ clienteId: string; contatoId?: string }> {
    let clienteId = dto.clienteId;

    if (!clienteId) {
      const cnpj = dto.cnpj?.trim();
      let cliente = cnpj
        ? await this.prisma.cliente.findUnique({ where: { cnpj } })
        : null;

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
        cliente = await this.prisma.cliente.create({
          data: { cnpj: cnpj || null, ...dadosCadastro },
        });
      } else {
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

  // ===== Calcula os totais (mensais) a partir dos valores dos equipamentos =====
  private montarTotais(dto: CreatePropostaDto) {
    const itensCalc = (dto.equipamentos || []).map((e) => ({
      quantidade: 1,
      valorItemCentavos: reaisParaCentavos(e.valorContrato),
    }));
    return calcTotais(itensCalc, dto.descontoPercent || 0);
  }

  // ===== Resolve o texto padrão de referência para o diff de customizações =====
  // Usa o snapshot enviado pelo front; se vazio, cai para o padrão do tipo.
  private resolverPadrao(dto: CreatePropostaDto): string {
    const snap = (dto.condicoesPadraoSnap ?? '').trim();
    if (snap) return dto.condicoesPadraoSnap as string;
    return CONDICOES_PADRAO[dto.tipoContrato || ''] ?? '';
  }

  // ===== Criar =====
  async create(dto: CreatePropostaDto, userId?: string) {
    const numero = dto.numero?.trim() || (await this.proximoNumero());
    const { clienteId, contatoId } = await this.resolverCliente(dto);
    const totais = this.montarTotais(dto);

    const condicoesPadrao = this.resolverPadrao(dto);
    // Backend é a fonte de verdade: recomputa o bloco de customizações nas
    // Observações Internas a partir do diff condições x padrão.
    const observacoesInternas = gerarObservacoesComCustomizacoes(
      dto.condicoesContrato ?? '',
      condicoesPadrao,
      dto.observacoesInternas ?? '',
    );

    const prop = await this.prisma.proposta.create({
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
        // contrato
        tipoContrato: dto.tipoContrato || '',
        condicoesContrato: dto.condicoesContrato ?? '',
        condicoesPadraoSnap: condicoesPadrao,
        observacoesInternas,
        textoFinal: dto.textoFinal ?? TEXTO_FINAL_PADRAO,
        // resumo
        descontoPercent: dto.descontoPercent || 0,
        subtotalCentavos: totais.subtotalCentavos,
        descontoCentavos: totais.descontoCentavos,
        totalCentavos: totais.totalCentavos,
        // status
        statusEnviado: !!dto.enviado,
        // equipamentos
        equipamentos: {
          create: (dto.equipamentos || []).map((e, i) => ({
            ordem: i,
            modalidade: e.modalidade || '',
            marca: e.marca || '',
            marcaOutras: e.marca === 'Outras' ? e.marcaOutras || '' : '',
            modelo: e.modelo || '',
            numeroSerie: e.numeroSerie || '',
            valorCentavos: reaisParaCentavos(e.valorContrato),
          })),
        },
      },
      include: PROP_INCLUDE,
    });

    return this.serialize(prop);
  }

  // ===== Atualizar (substitui os equipamentos) =====
  async update(id: string, dto: UpdatePropostaDto) {
    const atual = await this.ensure(id);
    const totais = this.montarTotais(dto);

    const condicoesPadrao = this.resolverPadrao(dto);
    const observacoesInternas = gerarObservacoesComCustomizacoes(
      dto.condicoesContrato ?? '',
      condicoesPadrao,
      dto.observacoesInternas ?? '',
    );

    const prop = await this.prisma.$transaction(async (tx) => {
      // remove os equipamentos atuais e recria (estratégia simples e previsível)
      await tx.itemPropostaEquip.deleteMany({ where: { propostaId: id } });

      // Mantém o cadastro do cliente atualizado com os dados de endereço mais
      // recentes informados na emissão (igual ao orçamento).
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

      return tx.proposta.update({
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
          tipoContrato: dto.tipoContrato || '',
          condicoesContrato: dto.condicoesContrato ?? '',
          condicoesPadraoSnap: condicoesPadrao,
          observacoesInternas,
          textoFinal: dto.textoFinal ?? TEXTO_FINAL_PADRAO,
          descontoPercent: dto.descontoPercent ?? 0,
          subtotalCentavos: totais.subtotalCentavos,
          descontoCentavos: totais.descontoCentavos,
          totalCentavos: totais.totalCentavos,
          statusEnviado: !!dto.enviado,
          equipamentos: {
            create: (dto.equipamentos || []).map((e, i) => ({
              ordem: i,
              modalidade: e.modalidade || '',
              marca: e.marca || '',
              marcaOutras: e.marca === 'Outras' ? e.marcaOutras || '' : '',
              modelo: e.modelo || '',
              numeroSerie: e.numeroSerie || '',
              valorCentavos: reaisParaCentavos(e.valorContrato),
            })),
          },
        },
        include: PROP_INCLUDE,
      });
    });

    // Gera o contrato automaticamente se a proposta estiver aprovada (idempotente).
    if ((prop as any).statusAprovado) {
      this.contrato.gerarDeProposta(id).catch(() => {
        // Não bloqueia a resposta — o contrato pode ser gerado depois.
      });
    }

    return this.serialize(prop);
  }

  // ===== Listar com filtros, busca, ordenação e paginação =====
  async list(q: ListarPropostasDto): Promise<Paginated<any>> {
    const where: Prisma.PropostaWhereInput = {};

    if (q.clienteId) where.clienteId = q.clienteId;
    if (q.cnpj) where.clienteCnpjSnap = { contains: q.cnpj };
    if (q.data) where.data = new Date(q.data);
    if (q.status) {
      const mapaStatus: Record<string, keyof Prisma.PropostaWhereInput> = {
        enviado: 'statusEnviado',
        aprovado: 'statusAprovado',
        realizado: 'statusRealizado',
        aguardandoPeca: 'statusAguardandoPeca',
        ordemServico: 'statusOrdemServico',
        pagamentoRealizado: 'statusPagamentoRealizado',
      };
      const campo = mapaStatus[q.status];
      if (campo) (where as Record<string, unknown>)[campo] = true;
    }
    if (q.busca) {
      where.OR = [
        { numero: { contains: q.busca, mode: 'insensitive' } },
        { clienteNomeSnap: { contains: q.busca, mode: 'insensitive' } },
        { clienteCnpjSnap: { contains: q.busca, mode: 'insensitive' } },
        { solicitanteSnap: { contains: q.busca, mode: 'insensitive' } },
        { tipoContrato: { contains: q.busca, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.PropostaOrderByWithRelationInput =
      q.order === 'data_asc'
        ? { data: 'asc' }
        : q.order === 'numero_desc'
          ? { numero: 'desc' }
          : q.order === 'numero_asc'
            ? { numero: 'asc' }
            : { data: 'desc' };

    const [rows, total] = await Promise.all([
      this.prisma.proposta.findMany({
        where,
        orderBy,
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: PROP_INCLUDE,
      }),
      this.prisma.proposta.count({ where }),
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
    const prop = await this.prisma.proposta.findUnique({
      where: { id },
      include: PROP_INCLUDE,
    });
    if (!prop) throw new NotFoundException('Proposta não encontrada');
    return this.serialize(prop);
  }

  // ===== Atualizar somente status (dropdown inline na Controle) =====
  async updateStatus(id: string, dto: UpdateStatusPropostaDto) {
    await this.ensure(id);
    const data: Prisma.PropostaUpdateInput = {};
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

    const prop = await this.prisma.proposta.update({
      where: { id },
      data,
      include: PROP_INCLUDE,
    });

    // Gera o contrato automaticamente na primeira vez que a proposta for aprovada.
    if (prop.statusAprovado) {
      this.contrato.gerarDeProposta(id).catch(() => {
        // Não bloqueia a resposta do status — o contrato pode ser gerado depois.
      });
    }

    return this.serialize(prop);
  }

  // ===== Buscar por número exato (case-insensitive) =====
  async buscarPorNumero(numero: string) {
    const alvo = (numero || '').trim();
    if (!alvo) throw new NotFoundException('Proposta não encontrada');
    const prop = await this.prisma.proposta.findFirst({
      where: { numero: { equals: alvo, mode: 'insensitive' } },
      include: PROP_INCLUDE,
    });
    if (!prop) throw new NotFoundException('Proposta não encontrada');
    return this.serialize(prop);
  }

  async remove(id: string) {
    await this.ensure(id);
    await this.prisma.proposta.delete({ where: { id } });
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
          'A proposta não tem e-mail do solicitante. Preencha o campo E-mail para enviar.',
      };
    }

    if (!this.email.configurado) {
      return {
        ok: false,
        mensagem:
          'Envio de e-mail ainda não configurado no servidor (SMTP). A proposta não foi enviada.',
      };
    }

    const pdf = await this.pdf.gerar(dados);
    const { assunto, html } = montarEmailProposta(dados);

    try {
      await this.email.enviar({
        para: destinatario,
        assunto,
        html,
        ccExtra: [CC_FIXO_PROPOSTA],
        anexoPdf: { nome: `${dados.numero || 'proposta'}.pdf`, conteudo: pdf },
      });
    } catch (e) {
      return {
        ok: false,
        mensagem:
          'Falha ao enviar o e-mail: ' +
          (e instanceof Error ? e.message : 'erro desconhecido'),
      };
    }

    const prop = await this.prisma.proposta.update({
      where: { id },
      data: { statusEnviado: true, enviadoEm: new Date() },
      include: PROP_INCLUDE,
    });

    return {
      ok: true,
      mensagem: `Proposta enviada para ${destinatario} (cópia para controle).`,
      proposta: this.serialize(prop),
    };
  }

  private async ensure(id: string) {
    const p = await this.prisma.proposta.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Proposta não encontrada');
    return p;
  }

  // ===== Serializa para o formato esperado pelo front (reais, ISO, campos planos) =====
  private serialize(p: any) {
    const isoDate = (d: Date | null) =>
      d ? new Date(d).toISOString().slice(0, 10) : '';
    return {
      id: p.id,
      numero: p.numero,
      data: isoDate(p.data),
      // empresa / endereço (snapshot tem prioridade; cai para o cadastro)
      cnpj: p.clienteCnpjSnap ?? p.cliente?.cnpj ?? '',
      empresa: p.clienteNomeSnap ?? p.cliente?.nome ?? '',
      cep: p.cliente?.cep ?? '',
      endereco: p.cliente?.endereco ?? '',
      enderecoNumero: p.cliente?.numero ?? '',
      complemento: p.cliente?.complemento ?? '',
      bairro: p.cliente?.bairro ?? '',
      cidade: p.cliente?.cidade ?? '',
      estado: p.cliente?.estado ?? '',
      pais: p.cliente?.pais ?? 'Brasil',
      // solicitante
      solicitante: p.solicitanteSnap ?? p.contato?.nome ?? '',
      setor: p.setorSnap ?? p.contato?.setor ?? '',
      telefone: p.telefoneSnap ?? p.contato?.telefone ?? '',
      email: p.emailSnap ?? p.contato?.email ?? '',
      // contrato
      tipoContrato: p.tipoContrato ?? '',
      condicoesContrato: p.condicoesContrato ?? '',
      condicoesPadraoSnap: p.condicoesPadraoSnap ?? '',
      observacoesInternas: p.observacoesInternas ?? '',
      // resumo
      descontoPercent: p.descontoPercent ?? 0,
      subtotal: centavosParaReais(p.subtotalCentavos),
      desconto: centavosParaReais(p.descontoCentavos),
      total: centavosParaReais(p.totalCentavos),
      // finalização
      textoFinal: p.textoFinal ?? '',
      // status (mesmos campos de controle do orçamento)
      enviado: p.statusEnviado,
      aprovado: p.statusAprovado ?? false,
      realizado: p.statusRealizado ?? false,
      aguardandoPeca: p.statusAguardandoPeca ?? false,
      ordemServico: p.statusOrdemServico ?? false,
      pagamentoRealizado: p.statusPagamentoRealizado ?? false,
      // equipamentos
      equipamentos: (p.equipamentos || []).map((e: any) => ({
        id: e.id,
        modalidade: e.modalidade ?? '',
        marca: e.marca ?? '',
        marcaOutras: e.marcaOutras ?? '',
        modelo: e.modelo ?? '',
        numeroSerie: e.numeroSerie ?? '',
        valorContrato: centavosParaReais(e.valorCentavos),
      })),
    };
  }
}
