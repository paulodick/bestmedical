import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { centavosParaReais } from '../orcamentos/orcamento.calc';
import { EmailService } from '../email/email.service';
import { ContratoPdfService } from './pdf/contrato-pdf.service';
import { montarEmailContrato } from './contrato-email.template';
import { gerarObservacoesComCustomizacoesContrato } from './contrato-customizacoes';
import {
  gerarCorpoContrato,
  numeroContratoDeProposta,
} from './contrato-template';
import { UpdateContratoDto } from './dto/contrato.dto';

// CC fixo de controle para o envio do contrato (além do MAIL_CC do servidor).
const CC_FIXO_CONTRATO = 'paulo@bestmedical.com.br';

// include padrão da proposta de origem (equipamentos ordenados + cliente/contato).
const PROP_INCLUDE = {
  equipamentos: { orderBy: { ordem: 'asc' } },
  cliente: true,
  contato: true,
} satisfies Prisma.PropostaInclude;

@Injectable()
export class ContratoService {
  constructor(
    private prisma: PrismaService,
    private pdf: ContratoPdfService,
    private email: EmailService,
  ) {}

  // ===== Mapeia a proposta (com relações) para o formato usado pelo template =====
  // O gerador do corpo (gerarCorpoContrato) e o PDF esperam os campos "planos"
  // em reais — o mesmo formato serializado da proposta no front.
  private propostaParaTemplate(p: any) {
    return {
      numero: p.numero,
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
      descontoPercent: p.descontoPercent ?? 0,
      total: centavosParaReais(p.totalCentavos),
      equipamentos: (p.equipamentos || []).map((e: any) => ({
        modalidade: e.modalidade ?? '',
        marca: e.marca ?? '',
        marcaOutras: e.marcaOutras ?? '',
        modelo: e.modelo ?? '',
        numeroSerie: e.numeroSerie ?? '',
        valorContrato: centavosParaReais(e.valorCentavos),
      })),
    };
  }

  // ===== Gera (ou retorna) o contrato vinculado a uma proposta =====
  // Idempotente: se já existir contrato para a proposta, devolve o existente.
  async gerarDeProposta(propostaId: string) {
    const existente = await this.prisma.contrato.findUnique({
      where: { propostaId },
    });
    if (existente) return this.serialize(existente);

    const prop = await this.prisma.proposta.findUnique({
      where: { id: propostaId },
      include: PROP_INCLUDE,
    });
    if (!prop) throw new NotFoundException('Proposta não encontrada');

    const corpo = gerarCorpoContrato(this.propostaParaTemplate(prop));
    const numero = numeroContratoDeProposta(prop.numero);

    const contrato = await this.prisma.contrato.create({
      data: {
        numero,
        propostaId,
        data: new Date(),
        // O corpo padrão (base do diff) e o customizado começam idênticos.
        conteudoPadraoSnap: corpo,
        conteudoCustomizado: corpo,
      },
    });

    return this.serialize(contrato);
  }

  async get(id: string) {
    const c = await this.prisma.contrato.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Contrato não encontrado');
    return this.serialize(c);
  }

  async getPorProposta(propostaId: string) {
    const c = await this.prisma.contrato.findUnique({ where: { propostaId } });
    if (!c) throw new NotFoundException('Contrato não encontrado');
    return this.serialize(c);
  }

  // ===== Atualizar o corpo do contrato =====
  // Salva o corpo customizado e replica o diff (corpo x padrão) nas Observações
  // Internas da PROPOSTA de origem, no mesmo formato de marcadores do sistema.
  async update(id: string, dto: UpdateContratoDto) {
    const atual = await this.prisma.contrato.findUnique({ where: { id } });
    if (!atual) throw new NotFoundException('Contrato não encontrado');

    const corpo = dto.conteudoCustomizado ?? atual.conteudoCustomizado;

    const contrato = await this.prisma.$transaction(async (tx) => {
      // Atualiza as Observações Internas da proposta com o bloco de
      // customizações do contrato (preserva o bloco das condições e o texto
      // manual existentes).
      const prop = await tx.proposta.findUnique({
        where: { id: atual.propostaId },
        select: { observacoesInternas: true },
      });
      const novasObs = gerarObservacoesComCustomizacoesContrato(
        corpo,
        atual.conteudoPadraoSnap,
        prop?.observacoesInternas ?? '',
      );
      await tx.proposta.update({
        where: { id: atual.propostaId },
        data: { observacoesInternas: novasObs },
      });

      return tx.contrato.update({
        where: { id },
        data: {
          conteudoCustomizado: corpo,
          ...(dto.data ? { data: new Date(dto.data) } : {}),
        },
      });
    });

    return this.serialize(contrato);
  }

  // ===== Enviar por e-mail (gera PDF, envia ao solicitante da proposta) =====
  async enviar(id: string) {
    const contrato = await this.prisma.contrato.findUnique({
      where: { id },
      include: { proposta: { include: PROP_INCLUDE } },
    });
    if (!contrato) throw new NotFoundException('Contrato não encontrado');

    const prop = contrato.proposta;
    const destinatario = (prop.emailSnap ?? prop.contato?.email ?? '').trim();
    if (!destinatario) {
      return {
        ok: false,
        mensagem:
          'A proposta de origem não tem e-mail do solicitante. Preencha o campo E-mail para enviar.',
      };
    }

    if (!this.email.configurado) {
      return {
        ok: false,
        mensagem:
          'Envio de e-mail ainda não configurado no servidor (SMTP). O contrato não foi enviado.',
      };
    }

    const dadosPdf = this.dadosParaPdf(contrato);
    const pdf = await this.pdf.gerar(dadosPdf);
    const { assunto, html } = montarEmailContrato(dadosPdf);

    try {
      await this.email.enviar({
        para: destinatario,
        assunto,
        html,
        ccExtra: [CC_FIXO_CONTRATO],
        anexoPdf: {
          nome: `${contrato.numero || 'contrato'}.pdf`,
          conteudo: pdf,
        },
      });
    } catch (e) {
      return {
        ok: false,
        mensagem:
          'Falha ao enviar o e-mail: ' +
          (e instanceof Error ? e.message : 'erro desconhecido'),
      };
    }

    const atualizado = await this.prisma.contrato.update({
      where: { id },
      data: { statusEnviado: true, enviadoEm: new Date() },
    });

    return {
      ok: true,
      mensagem: `Contrato enviado para ${destinatario} (cópia para controle).`,
      contrato: this.serialize(atualizado),
    };
  }

  // ===== Gera o PDF (download) =====
  async gerarPdf(id: string): Promise<{ numero: string; buffer: Buffer }> {
    const contrato = await this.prisma.contrato.findUnique({
      where: { id },
      include: { proposta: { include: PROP_INCLUDE } },
    });
    if (!contrato) throw new NotFoundException('Contrato não encontrado');
    const dados = this.dadosParaPdf(contrato);
    const buffer = await this.pdf.gerar(dados);
    return { numero: contrato.numero, buffer };
  }

  // Dados consolidados que o PDF/e-mail consomem (número, data, corpo, cliente).
  private dadosParaPdf(contrato: any) {
    const prop = contrato.proposta;
    const isoDate = (d: Date | null) =>
      d ? new Date(d).toISOString().slice(0, 10) : '';
    return {
      numero: contrato.numero,
      data: isoDate(contrato.data),
      conteudo: contrato.conteudoCustomizado,
      empresa: prop?.clienteNomeSnap ?? prop?.cliente?.nome ?? '',
      cnpj: prop?.clienteCnpjSnap ?? prop?.cliente?.cnpj ?? '',
      cidade: prop?.cliente?.cidade ?? '',
      estado: prop?.cliente?.estado ?? '',
      solicitante: prop?.solicitanteSnap ?? prop?.contato?.nome ?? '',
      numeroProposta: prop?.numero ?? '',
    };
  }

  // ===== Serializa para o formato do front =====
  private serialize(c: any) {
    const isoDate = (d: Date | null) =>
      d ? new Date(d).toISOString().slice(0, 10) : '';
    return {
      id: c.id,
      numero: c.numero,
      propostaId: c.propostaId,
      data: isoDate(c.data),
      conteudoPadraoSnap: c.conteudoPadraoSnap ?? '',
      conteudoCustomizado: c.conteudoCustomizado ?? '',
      enviado: c.statusEnviado ?? false,
      enviadoEm: c.enviadoEm ? new Date(c.enviadoEm).toISOString() : null,
    };
  }
}
