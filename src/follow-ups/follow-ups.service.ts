import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFollowUpDto, ListarFollowUpsDto } from './dto/follow-up.dto';
import { AuthUser } from '../auth/current-user.decorator';

@Injectable()
export class FollowUpsService {
  constructor(private prisma: PrismaService) {}

  // Lista os follow-ups de um orçamento OU de uma proposta,
  // ordenados pela data (createdAt) de forma DECRESCENTE (mais recente primeiro).
  async list(q: ListarFollowUpsDto) {
    if (!q.orcamentoId && !q.propostaId) {
      throw new BadRequestException(
        'Informe orcamentoId ou propostaId para listar os follow-ups.',
      );
    }
    const where: { orcamentoId?: string; propostaId?: string } = {};
    if (q.orcamentoId) where.orcamentoId = q.orcamentoId;
    if (q.propostaId) where.propostaId = q.propostaId;

    const rows = await this.prisma.followUp.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((r) => this.serialize(r));
  }

  // Cria um follow-up vinculado a um orçamento OU a uma proposta.
  // O autor é o usuário logado (nome usado como identificação na tabela).
  async create(dto: CreateFollowUpDto, user?: AuthUser) {
    if (!dto.orcamentoId && !dto.propostaId) {
      throw new BadRequestException(
        'Informe orcamentoId ou propostaId para criar o follow-up.',
      );
    }
    const texto = (dto.texto || '').trim();
    if (!texto) {
      throw new BadRequestException('O texto do follow-up é obrigatório.');
    }

    const row = await this.prisma.followUp.create({
      data: {
        orcamentoId: dto.orcamentoId || null,
        propostaId: dto.propostaId || null,
        autorId: user?.id || null,
        autorNome: (user?.nome || '').trim() || 'Usuário',
        texto,
      },
    });

    return this.serialize(row);
  }

  // Exclui um follow-up. Permitido apenas ao PRÓPRIO autor ou ao
  // administrador master (paulo@bestmedical.com.br), para evitar problemas.
  async remove(id: string, user?: AuthUser) {
    const fu = await this.prisma.followUp.findUnique({ where: { id } });
    if (!fu) throw new NotFoundException('Follow-up não encontrado.');

    const ehAutor = !!user?.id && fu.autorId === user.id;
    const ehAdminMaster =
      (user?.email || '').trim().toLowerCase() === 'paulo@bestmedical.com.br';

    if (!ehAutor && !ehAdminMaster) {
      throw new ForbiddenException(
        'Você só pode apagar os seus próprios comentários.',
      );
    }

    await this.prisma.followUp.delete({ where: { id } });
    return { ok: true };
  }

  private serialize(r: {
    id: string;
    orcamentoId: string | null;
    propostaId: string | null;
    autorId: string | null;
    autorNome: string;
    texto: string;
    createdAt: Date;
  }) {
    return {
      id: r.id,
      orcamentoId: r.orcamentoId,
      propostaId: r.propostaId,
      autorId: r.autorId,
      autorNome: r.autorNome,
      texto: r.texto,
      createdAt: new Date(r.createdAt).toISOString(),
    };
  }
}
