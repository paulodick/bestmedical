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
        const sep = classificarContato(c.nome, c.empresa);
        return {
          ...c,
          nome: sep.nome,
          empresa: sep.empresa || undefined,
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
// Inteligência: classificar o contato como PESSOA ou EMPRESA.
//
// Objetivo (definido pelo usuário): ao importar, detectar se o texto do
// contato é nome de PESSOA (vai para o campo Nome) ou nome de EMPRESA /
// organização / algo que não seja pessoa (vai para o campo Empresa).
// Em caso de DÚVIDA, deixa tudo no campo Nome para o usuário ajustar.
//
// Regras:
//  - Se o vCard/CSV já trouxe uma EMPRESA (ORG) preenchida, respeita: o
//    texto principal fica como Nome (pessoa) e a empresa no seu campo.
//  - Sem empresa: pontuamos sinais de "empresa" vs "pessoa". Se os sinais
//    de empresa forem claros, movemos TUDO para Empresa (Nome vazio).
//  - Caso contrário, mantemos TUDO em Nome (comportamento conservador).
// ===================================================================
function classificarContato(
  textoBruto: string,
  empresaExistente?: string | null,
): { nome: string; empresa: string | null } {
  const texto = (textoBruto || '').trim();

  // 1) Já veio empresa de um campo dedicado (ORG do vCard / coluna do CSV).
  if (empresaExistente && empresaExistente.trim()) {
    return { nome: texto, empresa: empresaExistente.trim() };
  }

  if (!texto) return { nome: texto, empresa: null };

  // 2) Sem empresa: decide se o PRÓPRIO texto é uma empresa.
  if (pareceEmpresa(texto)) {
    return { nome: '', empresa: texto };
  }

  // 3) Dúvida ou pessoa: deixa tudo no Nome (usuário ajusta).
  return { nome: texto, empresa: null };
}

// Decide se um texto é nome de EMPRESA/organização (e não de pessoa).
// Conservador: na dúvida retorna false (mantém como Nome de pessoa).
function pareceEmpresa(texto: string): boolean {
  const original = texto.trim();
  if (!original) return false;

  const norm = removerAcentos(original.toLowerCase());
  const palavras = norm.split(/\s+/).filter(Boolean);

  // a) Sufixos/termos jurídicos e de razão social.
  const TERMOS_JURIDICOS = [
    'ltda', 'eireli', 'mei', 'epp', 'cia', 'slu', 'inc', 'corp',
    'corporation', 'llc', 'gmbh', 'sociedade', 'associacao', 'fundacao',
    'cooperativa', 'holding', 'group', 'grupo',
  ];
  if (palavras.some((p) => TERMOS_JURIDICOS.includes(p))) return true;
  // "me", "ei", "sa" só contam como empresa em razão social (2+ palavras).
  if (
    palavras.length >= 2 &&
    palavras.some((p) => ['me', 'ei', 'sa'].includes(p))
  ) {
    return true;
  }

  // b) Palavras-chave de negócio / segmento (forte indicador).
  const PALAVRAS_NEGOCIO = [
    'hospital', 'clinica', 'clinicas', 'laboratorio', 'lab', 'farmacia',
    'drogaria', 'medical', 'medica', 'medicos', 'saude', 'odonto',
    'odontologia', 'imd', 'instituto', 'centro', 'policlinica', 'upa',
    'maternidade', 'unimed', 'comercio', 'comercial', 'industria',
    'industrial', 'distribuidora', 'representacoes', 'representacao',
    'servicos', 'solucoes', 'tecnologia', 'sistemas', 'engenharia',
    'construtora', 'transportes', 'transportadora', 'logistica',
    'consultoria', 'assessoria', 'agencia', 'loja', 'magazine',
    'supermercado', 'mercado', 'atacado', 'varejo', 'restaurante',
    'lanchonete', 'padaria', 'hotel', 'pousada', 'oficina', 'autopecas',
    'pecas', 'materiais', 'equipamentos', 'eletro', 'eletronica',
    'informatica', 'telecom', 'energia', 'imobiliaria', 'imoveis',
    'seguros', 'corretora', 'financeira', 'contabilidade', 'advocacia',
    'advogados', 'associados', 'partners', 'company', 'enterprise',
    'industries', 'foods', 'store', 'studios', 'studio', 'agropecuaria',
  ];
  if (palavras.some((p) => PALAVRAS_NEGOCIO.includes(p))) return true;

  // c) Símbolos típicos de razão social.
  if (/[&@]/.test(original)) return true;
  if (/\bltda\b|\bs\.?a\.?\b/i.test(original)) return true;
  // Números embutidos com 2+ palavras (ex.: "Auto Center 24h").
  if (/\d/.test(original) && palavras.length >= 2) return true;

  // d) TUDO EM MAIÚSCULAS com 2+ palavras costuma ser razão social.
  const ehMaiusculas =
    original === original.toUpperCase() && /[A-ZÀ-Ý]/.test(original);
  if (ehMaiusculas && palavras.length >= 2) return true;

  // --- Sinais de PESSOA (se presentes, NÃO é empresa) ---
  if (palavras.length >= 1 && PRIMEIROS_NOMES.has(palavras[0])) return false;
  if (palavras.some((p) => ['de', 'da', 'do', 'dos', 'das'].includes(p))) {
    return false;
  }

  // Sem sinais claros -> trata como PESSOA (deixa no Nome). Conservador.
  return false;
}

function removerAcentos(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Lista de primeiros nomes próprios comuns no Brasil (normalizados, sem acento).
// Quando a 1ª palavra do contato está aqui, mantemos tudo como Nome.
const PRIMEIROS_NOMES = new Set<string>([
  'ana', 'maria', 'jose', 'joao', 'antonio', 'francisco', 'carlos', 'paulo',
  'pedro', 'lucas', 'luiz', 'luis', 'marcos', 'gabriel', 'rafael', 'daniel',
  'marcelo', 'bruno', 'eduardo', 'felipe', 'rodrigo', 'manoel', 'manuel',
  'fernando', 'roberto', 'gustavo', 'ricardo', 'sergio', 'fabio', 'vinicius',
  'andre', 'leonardo', 'alexandre', 'mateus', 'matheus', 'thiago', 'tiago',
  'guilherme', 'henrique', 'arthur', 'davi', 'miguel', 'bernardo', 'heitor',
  'samuel', 'caio', 'diego', 'leandro', 'wesley', 'julio', 'cesar', 'renato',
  'adriano', 'alex', 'anderson', 'jorge', 'raimundo', 'sebastiao', 'claudio',
  'vitor', 'victor', 'igor', 'otavio', 'enzo', 'theo', 'benjamin', 'isaac',
  'joaquim', 'nicolas', 'emanuel', 'mauro', 'mauricio', 'edson', 'jefferson',
  'juliana', 'fernanda', 'patricia', 'aline', 'amanda', 'bruna', 'camila',
  'carla', 'carolina', 'beatriz', 'jessica', 'leticia', 'larissa', 'mariana',
  'gabriela', 'rafaela', 'vanessa', 'vivian', 'tatiane', 'tatiana', 'sandra',
  'simone', 'sonia', 'rita', 'rosa', 'rosana', 'cristina', 'cristiane',
  'daniela', 'debora', 'eliane', 'fabiana', 'flavia', 'helena', 'isabela',
  'isabella', 'julia', 'laura', 'luana', 'lucia', 'luciana', 'marcia',
  'marta', 'monica', 'natalia', 'priscila', 'renata', 'sabrina', 'sara',
  'sarah', 'silvia', 'tania', 'teresa', 'thais', 'valeria', 'viviane',
  'alice', 'cecilia', 'clara', 'emilly', 'manuela', 'sofia', 'sophia',
  'valentina', 'lara', 'livia', 'agatha', 'elaine', 'kelly', 'jaqueline',
  'angela', 'aparecida', 'regina', 'roberta', 'denise', 'eliana', 'graziela',
]);

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

    const sep = classificarContato(nome, org || null);

    contatos.push({
      nome: sep.nome,
      empresa: sep.empresa || undefined,
      telefone,
      telefonePessoal,
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
