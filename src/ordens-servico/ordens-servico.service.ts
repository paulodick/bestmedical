import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateOrdemServicoDto } from './dto/ordem-servico.dto';
import { OsPdfService } from './pdf/os-pdf.service';
import { EmailService } from '../email/email.service';

// CC fixo para o envio da OS (além do MAIL_CC configurado no servidor)
const CC_FIXO_OS = 'paulo@bestmedical.com.br';

// Include padrão para trazer itens e fotos ordenados
const OS_INCLUDE = {
  itens: { orderBy: { ordem: 'asc' as const } },
  fotos: { orderBy: { ordem: 'asc' as const } },
} as const;

@Injectable()
export class OrdensServicoService {
  constructor(
    private prisma: PrismaService,
    private pdf: OsPdfService,
    private email: EmailService,
  ) {}

  // ===== Cria a OS a partir de um orçamento (idempotente) =====
  // Chamado automaticamente quando o orçamento é aprovado.
  // Se já existir uma OS para este orçamento, retorna a existente sem criar outra.
  async criarAPartirDoOrcamento(orcamentoId: string) {
    // Verifica se já existe uma OS para este orçamento
    const existente = await this.prisma.ordemServico.findUnique({
      where: { orcamentoId },
      include: OS_INCLUDE,
    });
    if (existente) {
      return this.serialize(existente);
    }

    // Busca o orçamento com itens para copiar o snapshot
    const orc = await this.prisma.orcamento.findUnique({
      where: { id: orcamentoId },
      include: {
        itens: { orderBy: { ordem: 'asc' } },
        cliente: true,
        contato: true,
      },
    });
    if (!orc) throw new NotFoundException('Orçamento não encontrado');

    // Deriva o número da OS: ORC-2026-0001 → OS-2026-0001
    // Suporte case-insensitive e fallback se não iniciar com ORC
    const numero = orc.numero.replace(/^ORC-/i, 'OS-');
    const numeroFinal = numero === orc.numero
      ? `OS-${orc.numero}`   // fallback: não começava com ORC
      : numero;

    // Cria a OS com snapshot de cliente/endereço/equipamento e itens copiados
    const os = await this.prisma.ordemServico.create({
      data: {
        numero: numeroFinal,
        orcamentoId,
        data: new Date(),
        // Snapshot de cliente
        clienteNomeSnap: orc.clienteNomeSnap ?? orc.cliente?.nome,
        clienteCnpjSnap: orc.clienteCnpjSnap ?? orc.cliente?.cnpj,
        // Endereço (copia do cadastro do cliente)
        cep: orc.cliente?.cep,
        endereco: orc.cliente?.endereco,
        enderecoNumero: orc.cliente?.numero,
        complemento: orc.cliente?.complemento,
        bairro: orc.cliente?.bairro,
        cidade: orc.cliente?.cidade,
        estado: orc.cliente?.estado,
        pais: orc.cliente?.pais ?? 'Brasil',
        // Snapshot de solicitante
        solicitanteSnap: orc.solicitanteSnap ?? orc.contato?.nome,
        setorSnap: orc.setorSnap ?? orc.contato?.setor,
        telefoneSnap: orc.telefoneSnap ?? orc.contato?.telefone,
        emailSnap: orc.emailSnap ?? orc.contato?.email,
        // Equipamento
        modalidade: orc.modalidade,
        marca: orc.marca,
        marcaOutras: orc.marcaOutras,
        modelo: orc.modelo,
        numeroSerie: orc.numeroSerie,
        descricaoVisita: orc.descricaoVisita,
        // Itens copiados do orçamento
        itens: {
          create: orc.itens.map((it, i) => ({
            ordem: it.ordem ?? i,
            codigo: it.codigo ?? '',
            descricao: it.descricao ?? '',
            quantidade: it.quantidade ?? 1,
            realizado: false,
            detalhes: '',
          })),
        },
      },
      include: OS_INCLUDE,
    });

    return this.serialize(os);
  }

  // ===== Busca uma OS pelo id =====
  async get(id: string) {
    const os = await this.prisma.ordemServico.findUnique({
      where: { id },
      include: OS_INCLUDE,
    });
    if (!os) throw new NotFoundException('Ordem de Serviço não encontrada');
    return this.serialize(os);
  }

  // ===== Busca a OS pelo id do orçamento =====
  async getPorOrcamento(orcamentoId: string) {
    const os = await this.prisma.ordemServico.findUnique({
      where: { orcamentoId },
      include: OS_INCLUDE,
    });
    if (!os) throw new NotFoundException('Ordem de Serviço não encontrada para este orçamento');
    return this.serialize(os);
  }

  // ===== Lista todas as OS (paginação simples) =====
  async list(page = 1, pageSize = 50) {
    const skip = (page - 1) * pageSize;
    const [rows, total] = await Promise.all([
      this.prisma.ordemServico.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: OS_INCLUDE,
      }),
      this.prisma.ordemServico.count(),
    ]);
    return {
      data: rows.map((r) => this.serialize(r)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  // ===== Atualiza campos editáveis (itens/fotos/assinaturas/textos) =====
  async update(id: string, dto: UpdateOrdemServicoDto) {
    await this.ensureExists(id);

    const os = await this.prisma.$transaction(async (tx) => {
      // Substitui itens se fornecidos
      if (dto.itens !== undefined) {
        await tx.itemOS.deleteMany({ where: { ordemId: id } });
        if (dto.itens.length > 0) {
          await tx.itemOS.createMany({
            data: dto.itens.map((it, i) => ({
              ordemId: id,
              ordem: i,
              codigo: it.codigo ?? '',
              descricao: it.descricao ?? '',
              quantidade: it.quantidade ?? 1,
              realizado: it.realizado ?? false,
              detalhes: it.detalhes ?? '',
            })),
          });
        }
      }

      // Substitui fotos se fornecidas (máx. 10)
      if (dto.fotos !== undefined) {
        await tx.fotoOS.deleteMany({ where: { ordemId: id } });
        const fotosValidas = (dto.fotos || []).slice(0, 10);
        if (fotosValidas.length > 0) {
          await tx.fotoOS.createMany({
            data: fotosValidas.map((f, i) => ({
              ordemId: id,
              ordem: i,
              dataUrl: f.dataUrl ?? '',
              legenda: f.legenda ?? '',
            })),
          });
        }
      }

      // Atualiza campos da OS
      return tx.ordemServico.update({
        where: { id },
        data: {
          ...(dto.descricaoServico !== undefined
            ? { descricaoServico: dto.descricaoServico }
            : {}),
          ...(dto.observacoes !== undefined
            ? { observacoes: dto.observacoes }
            : {}),
          ...(dto.assinaturaCliente !== undefined
            ? { assinaturaCliente: dto.assinaturaCliente }
            : {}),
          ...(dto.assinaturaTecnico !== undefined
            ? { assinaturaTecnico: dto.assinaturaTecnico }
            : {}),
        },
        include: OS_INCLUDE,
      });
    });

    return this.serialize(os);
  }

  // ===== Envia a OS por e-mail para múltiplos destinatários =====
  async enviar(id: string, destinatarios: string[]) {
    await this.ensureExists(id);
    const dados = await this.get(id);

    if (!destinatarios || destinatarios.length === 0) {
      return {
        ok: false,
        mensagem: 'Informe ao menos um destinatário para o envio.',
      };
    }

    if (!this.email.configurado) {
      return {
        ok: false,
        mensagem:
          'Envio de e-mail ainda não configurado no servidor (SMTP). A OS não foi enviada.',
      };
    }

    // Gera o PDF
    const pdf = await this.pdf.gerar(dados);

    const assunto = `Ordem de Serviço ${dados.numero} — Best Medical`;
    const html = `
      <p>Olá,</p>
      <p>Segue em anexo a <strong>Ordem de Serviço ${dados.numero}</strong> da Best Medical.</p>
      <p>Em caso de dúvidas, entre em contato conosco.</p>
      <p style="margin-top:16px;color:#475569;font-size:13px;">
        Best Medical — Manutenção de Equipamentos Médicos<br/>
        <em>When uptime matters.</em>
      </p>
    `;

    try {
      await this.email.enviar({
        // Usa paraVarios para envio múltiplo
        para: destinatarios[0],
        paraVarios: destinatarios,
        assunto,
        html,
        // CC fixo paulo@ além do MAIL_CC
        ccExtra: [CC_FIXO_OS],
        anexoPdf: {
          nome: `${dados.numero || 'ordem-servico'}.pdf`,
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

    // Marca como enviada
    await this.prisma.ordemServico.update({
      where: { id },
      data: { statusEnviado: true, enviadoEm: new Date() },
    });

    return {
      ok: true,
      mensagem: `OS enviada para ${destinatarios.join(', ')} (CC: ${CC_FIXO_OS}).`,
    };
  }

  // ===== Garante que a OS existe =====
  private async ensureExists(id: string) {
    const os = await this.prisma.ordemServico.findUnique({ where: { id } });
    if (!os) throw new NotFoundException('Ordem de Serviço não encontrada');
    return os;
  }

  // ===== Serializa para o formato esperado pelo front =====
  // Lê direto dos campos da OS (snapshots já foram copiados na criação).
  serialize(os: any) {
    const isoDate = (d: Date | null) =>
      d ? new Date(d).toISOString().slice(0, 10) : '';

    return {
      id: os.id,
      numero: os.numero,
      orcamentoId: os.orcamentoId,
      data: isoDate(os.data),
      // Empresa / endereço (snapshots da OS)
      cnpj: os.clienteCnpjSnap ?? '',
      empresa: os.clienteNomeSnap ?? '',
      cep: os.cep ?? '',
      endereco: os.endereco ?? '',
      enderecoNumero: os.enderecoNumero ?? '',
      complemento: os.complemento ?? '',
      bairro: os.bairro ?? '',
      cidade: os.cidade ?? '',
      estado: os.estado ?? '',
      pais: os.pais ?? 'Brasil',
      // Solicitante
      solicitante: os.solicitanteSnap ?? '',
      setor: os.setorSnap ?? '',
      telefone: os.telefoneSnap ?? '',
      email: os.emailSnap ?? '',
      // Equipamento
      modalidade: os.modalidade ?? '',
      marca: os.marca ?? '',
      marcaOutras: os.marcaOutras ?? '',
      modelo: os.modelo ?? '',
      numeroSerie: os.numeroSerie ?? '',
      descricaoVisita: os.descricaoVisita ?? '',
      // Campos próprios da OS
      descricaoServico: os.descricaoServico ?? '',
      observacoes: os.observacoes ?? '',
      assinaturaCliente: os.assinaturaCliente ?? '',
      assinaturaTecnico: os.assinaturaTecnico ?? '',
      // Status
      enviado: os.statusEnviado,
      // Itens com campo 'item' (espelha o orçamento)
      itens: (os.itens || []).map((it: any) => ({
        id: it.id,
        codigo: it.codigo,
        item: it.descricao,
        quantidade: it.quantidade,
        realizado: it.realizado,
        detalhes: it.detalhes,
      })),
      // Fotos
      fotos: (os.fotos || []).map((f: any) => ({
        id: f.id,
        dataUrl: f.dataUrl,
        legenda: f.legenda,
        ordem: f.ordem,
      })),
    };
  }
}
