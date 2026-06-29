import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClienteDto, UpdateClienteDto } from './dto/cliente.dto';
import { PaginationDto, Paginated } from '../common/dto/pagination.dto';
import { Cliente, Prisma } from '@prisma/client';

@Injectable()
export class ClientesService {
  constructor(private prisma: PrismaService) {}

  async list(q: PaginationDto): Promise<Paginated<Cliente>> {
    const where: Prisma.ClienteWhereInput = q.busca
      ? {
          OR: [
            { nome: { contains: q.busca, mode: 'insensitive' } },
            { cnpj: { contains: q.busca, mode: 'insensitive' } },
            { cidade: { contains: q.busca, mode: 'insensitive' } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.cliente.findMany({
        where,
        orderBy: { nome: 'asc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.cliente.count({ where }),
    ]);

    return {
      data,
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.ceil(total / q.pageSize) || 1,
    };
  }

  // ===== Autocompletar por CNPJ =====
  // Usado na tela de Novo Orçamento: ao digitar o CNPJ, devolve os dados
  // cadastrais da empresa (endereço, número, complemento etc.) e os dados do
  // último solicitante usado, para preencher o formulário automaticamente.
  // Retorna null (200) quando o CNPJ ainda não existe — assim o front trata
  // como “novo cliente” sem precisar lidar com erro 404.
  async buscarPorCnpj(cnpjBruto: string) {
    const cnpj = (cnpjBruto || '').trim();
    if (!cnpj) return null;

    // Normaliza para só dígitos para comparar independentemente da máscara.
    const digitos = cnpj.replace(/\D/g, '');
    if (digitos.length !== 14) return null;

    // 1) Tenta achar um cliente já cadastrado (com máscara OU só dígitos).
    const cliente = await this.prisma.cliente.findFirst({
      where: {
        OR: [
          { cnpj },
          { cnpj: digitos },
          { cnpj: this.formatarCnpj(digitos) },
        ],
      },
      include: {
        // contato mais recente para sugerir solicitante/setor/contato
        contatos: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (cliente) {
      const contato = cliente.contatos[0];
      return {
        encontrado: true,
        fonte: 'cadastro',
        cnpj: cliente.cnpj ?? '',
        empresa: cliente.nome ?? '',
        cep: cliente.cep ?? '',
        endereco: cliente.endereco ?? '',
        enderecoNumero: cliente.numero ?? '',
        complemento: cliente.complemento ?? '',
        bairro: cliente.bairro ?? '',
        cidade: cliente.cidade ?? '',
        estado: cliente.estado ?? '',
        pais: cliente.pais ?? 'Brasil',
        // dados do último solicitante (editáveis no front)
        solicitante: contato?.nome ?? '',
        setor: contato?.setor ?? '',
        telefone: contato?.telefone ?? '',
        email: contato?.email ?? '',
      };
    }

    // 2) Cliente novo: consulta o cadastro público (BrasilAPI / Receita).
    const publico = await this.consultarCnpjPublico(digitos);
    if (publico) return publico;

    return null;
  }

  // Formata 14 dígitos como 00.000.000/0000-00
  private formatarCnpj(d: string): string {
    if (d.length !== 14) return d;
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }

  // GET JSON usando o módulo https nativo (independe de fetch global).
  private getJson(url: string, timeoutMs = 8000): Promise<any | null> {
    // import dinâmico para não exigir tipos no topo do arquivo
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const https = require('https');
    return new Promise((resolve) => {
      try {
        const req = https.get(
          url,
          { headers: { 'User-Agent': 'BestMedical/1.0', Accept: 'application/json' } },
          (res: any) => {
            if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
              res.resume();
              return resolve(null);
            }
            let data = '';
            res.on('data', (c: any) => (data += c));
            res.on('end', () => {
              try {
                resolve(JSON.parse(data));
              } catch {
                resolve(null);
              }
            });
          },
        );
        req.setTimeout(timeoutMs, () => {
          req.destroy();
          resolve(null);
        });
        req.on('error', () => resolve(null));
      } catch {
        resolve(null);
      }
    });
  }

  // Consulta dados públicos do CNPJ. Tenta BrasilAPI e, se falhar, ReceitaWS.
  // Em caso de erro/timeout, retorna null para o fluxo seguir como cliente novo.
  private async consultarCnpjPublico(digitos: string) {
    // 1) BrasilAPI
    const b = await this.getJson(`https://brasilapi.com.br/api/cnpj/v1/${digitos}`);
    if (b && (b.razao_social || b.nome_fantasia)) {
      const tel = (b.ddd_telefone_1 || b.ddd_telefone_2 || '').toString().trim();
      return {
        encontrado: true,
        fonte: 'receita',
        cnpj: this.formatarCnpj(digitos),
        empresa: (b.nome_fantasia || b.razao_social || '').toString().trim(),
        cep: (b.cep || '').toString().replace(/\D/g, ''),
        endereco: [b.descricao_tipo_de_logradouro, b.logradouro]
          .filter(Boolean)
          .join(' ')
          .trim(),
        enderecoNumero: (b.numero || '').toString(),
        complemento: (b.complemento || '').toString(),
        bairro: (b.bairro || '').toString(),
        cidade: (b.municipio || '').toString(),
        estado: (b.uf || '').toString(),
        pais: 'Brasil',
        solicitante: '',
        setor: '',
        telefone: tel,
        email: (b.email || '').toString(),
      };
    }

    // 2) ReceitaWS (fallback)
    const r = await this.getJson(`https://receitaws.com.br/v1/cnpj/${digitos}`);
    if (r && r.status === 'OK' && (r.nome || r.fantasia)) {
      return {
        encontrado: true,
        fonte: 'receita',
        cnpj: this.formatarCnpj(digitos),
        empresa: (r.fantasia || r.nome || '').toString().trim(),
        cep: (r.cep || '').toString().replace(/\D/g, ''),
        endereco: (r.logradouro || '').toString(),
        enderecoNumero: (r.numero || '').toString(),
        complemento: (r.complemento || '').toString(),
        bairro: (r.bairro || '').toString(),
        cidade: (r.municipio || '').toString(),
        estado: (r.uf || '').toString(),
        pais: 'Brasil',
        solicitante: '',
        setor: '',
        telefone: (r.telefone || '').toString(),
        email: (r.email || '').toString(),
      };
    }

    return null;
  }

  async get(id: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id },
      include: { contatos: true },
    });
    if (!cliente) throw new NotFoundException('Cliente não encontrado');
    return cliente;
  }

  create(dto: CreateClienteDto) {
    return this.prisma.cliente.create({ data: dto });
  }

  async update(id: string, dto: UpdateClienteDto) {
    await this.get(id);
    return this.prisma.cliente.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.get(id);
    await this.prisma.cliente.delete({ where: { id } });
    return { ok: true };
  }
}
