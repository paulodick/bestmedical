import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCrmContatoDto,
  ImportarContatosDto,
  ImportarContatoItemDto,
  UpdateCrmContatoDto,
} from './dto/crm-contato.dto';
import { PaginationDto, Paginated } from '../common/dto/pagination.dto';
import { CrmContato, Prisma } from '@prisma/client';
import { separarContato } from './contato-parser';

@Injectable()
export class CrmService {
  constructor(private prisma: PrismaService) {}

  // ===== Listagem com busca + paginação =====
  async list(q: PaginationDto): Promise<Paginated<CrmContato>> {
    const where: Prisma.CrmContatoWhereInput = q.busca
      ? {
          OR: [
            { nome: { contains: q.busca, mode: 'insensitive' } },
            { empresa: { contains: q.busca, mode: 'insensitive' } },
            { email: { contains: q.busca, mode: 'insensitive' } },
            { telefone: { contains: q.busca, mode: 'insensitive' } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.crmContato.findMany({
        where,
        orderBy: [{ relacionamento: 'desc' }, { nome: 'asc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.crmContato.count({ where }),
    ]);

    return {
      data,
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.ceil(total / q.pageSize) || 1,
    };
  }

  create(dto: CreateCrmContatoDto) {
    return this.prisma.crmContato.create({
      data: { ...dto, relacionamento: dto.relacionamento ?? 1 },
    });
  }


  async update(id: string, dto: UpdateCrmContatoDto) {
    await this.ensure(id);
    return this.prisma.crmContato.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.ensure(id);
    await this.prisma.crmContato.delete({ where: { id } });
    return { ok: true };
  }

  // Apaga TODOS os contatos do CRM de uma vez. Retorna a quantidade removida.
  async removerTodos() {
    const r = await this.prisma.crmContato.deleteMany({});
    return { ok: true, removidos: r.count };
  }

  // Exclui em lote os contatos cujos ids foram selecionados na tela.
  async removerLote(ids: string[]) {
    const unicos = Array.from(new Set((ids || []).filter(Boolean)));
    if (!unicos.length) return { ok: true, removidos: 0 };
    const r = await this.prisma.crmContato.deleteMany({
      where: { id: { in: unicos } },
    });
    return { ok: true, removidos: r.count };
  }

  private async ensure(id: string) {
    const c = await this.prisma.crmContato.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Contato não encontrado');
  }

  // ===== Importação (vCard ou lista estruturada) =====
  async importar(dto: ImportarContatosDto) {
    let itens: ImportarContatoItemDto[] = [];

    if (dto.vcard && dto.vcard.trim()) {
      itens = parseVCard(dto.vcard);
    } else if (dto.contatos && dto.contatos.length) {
      itens = dto.contatos.map((c) => {
        const sep = separarContato(c.nome, c.empresa, c.telefone);
        return {
          ...c,
          nome: sep.nome,
          empresa: sep.empresa || undefined,
          cidade: c.cidade || sep.cidade || undefined,
          estado: c.estado || sep.estado || undefined,
        };
      });
    }

    // Remove itens sem nome e normaliza.
    const limpos = itens
      .map((c) => ({
        nome: (c.nome || '').trim(),
        empresa: (c.empresa || '').trim() || null,
        telefone: (c.telefone || '').trim() || null,
        telefonePessoal: (c.telefonePessoal || '').trim() || null,
        cidade: (c.cidade || '').trim() || null,
        estado: (c.estado || '').trim().toUpperCase().slice(0, 2) || null,
        email: (c.email || '').trim() || null,
        relacionamento:
          c.relacionamento && c.relacionamento >= 1 && c.relacionamento <= 5
            ? c.relacionamento
            : 1,
      }))
      .filter((c) => c.nome);

    if (!limpos.length) {
      return { importados: 0, ignorados: 0, total: 0 };
    }

    const result = await this.prisma.crmContato.createMany({
      data: limpos,
    });

    return {
      importados: result.count,
      ignorados: itens.length - limpos.length,
      total: itens.length,
    };
  }
}


// ===================================================================
// Parser de vCard (.vcf) — versões 2.1 / 3.0 / 4.0.
// Extrai: FN (nome completo), N (estruturado), ORG (empresa),
// TEL (telefones, separando celular/pessoal), EMAIL.
// ===================================================================
function parseVCard(texto: string): ImportarContatoItemDto[] {
  const contatos: ImportarContatoItemDto[] = [];
  // Junta linhas dobradas (continuação começa com espaço/tab).
  const normalizado = texto.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
  const blocos = normalizado.split(/BEGIN:VCARD/i).slice(1);

  for (const bloco of blocos) {
    const linhas = bloco.split('\n').map((l) => l.trim()).filter(Boolean);

    let fn = '';
    let nEstruturado = '';
    let org = '';
    const telefones: { valor: string; pessoal: boolean }[] = [];
    let email = '';

    for (const linha of linhas) {
      const idx = linha.indexOf(':');
      if (idx === -1) continue;
      let esquerda = linha.slice(0, idx);
      const valor = decodificarValor(linha.slice(idx + 1).trim(), esquerda);
      // Remove prefixo de grupo do vCard (ex.: "item1.TEL" -> "TEL",
      // "item2.EMAIL" -> "EMAIL"). Comum em exportações de iPhone/Google.
      esquerda = esquerda.replace(/^item\d+\./i, '');
      const nomeCampo = esquerda.split(';')[0].toUpperCase();
      const paramsUpper = esquerda.toUpperCase();

      if (nomeCampo === 'FN') {
        fn = valor;
      } else if (nomeCampo === 'N') {
        // N: Sobrenome;Nome;NomeDoMeio;Prefixo;Sufixo
        const p = valor.split(';').map((x) => x.trim());
        const sobren = p[0] || '';
        const prim = p[1] || '';
        nEstruturado = [prim, sobren].filter(Boolean).join(' ').trim();
      } else if (nomeCampo === 'ORG') {
        org = valor.split(';')[0].trim();
      } else if (nomeCampo === 'TEL') {
        const num = valor.trim();
        if (num) {
          const pessoal =
            /HOME/.test(paramsUpper) && !/WORK/.test(paramsUpper);
          telefones.push({ valor: num, pessoal });
        }
      } else if (nomeCampo === 'EMAIL') {
        if (!email && valor.trim()) email = valor.trim();
      }
    }

    const nome = (fn || nEstruturado).trim();
    if (!nome) continue;

    // Separa telefone comercial (1ª coluna) de pessoal (2ª coluna).
    const pessoais = telefones.filter((t) => t.pessoal).map((t) => t.valor);
    const outros = telefones.filter((t) => !t.pessoal).map((t) => t.valor);
    // Ordem geral de aparição, para preencher de forma previsível.
    const ordem = telefones.map((t) => t.valor);

    let telefone: string | undefined;
    let telefonePessoal: string | undefined;

    if (outros.length) {
      telefone = outros[0];
      telefonePessoal = pessoais[0] || outros[1] || undefined;
    } else if (pessoais.length) {
      // Sem telefone "work": 1º vira principal, 2º vira pessoal.
      telefone = pessoais[0];
      telefonePessoal = pessoais[1] || undefined;
    } else if (ordem.length) {
      telefone = ordem[0];
      telefonePessoal = ordem[1] || undefined;
    }

    // Usa o telefone principal para cruzar DDD -> UF na separação.
    const sep = separarContato(nome, org || null, telefone);

    contatos.push({
      nome: sep.nome,
      empresa: sep.empresa || undefined,
      telefone,
      telefonePessoal,
      cidade: sep.cidade || undefined,
      estado: sep.estado || undefined,
      email: email || undefined,
      relacionamento: 1,
    });
  }

  return contatos;
}

// Decodifica valores de vCard com QUOTED-PRINTABLE (comum no vCard 2.1).
function decodificarValor(valor: string, params: string): string {
  if (/QUOTED-PRINTABLE/i.test(params)) {
    try {
      const semQuebras = valor.replace(/=\n/g, '');
      const bytes: number[] = [];
      for (let i = 0; i < semQuebras.length; i++) {
        if (semQuebras[i] === '=' && i + 2 < semQuebras.length) {
          bytes.push(parseInt(semQuebras.substr(i + 1, 2), 16));
          i += 2;
        } else {
          bytes.push(semQuebras.charCodeAt(i));
        }
      }
      // Decodifica como UTF-8 para preservar acentos.
      return Buffer.from(bytes).toString('utf8');
    } catch {
      return valor;
    }
  }
  return valor;
}
