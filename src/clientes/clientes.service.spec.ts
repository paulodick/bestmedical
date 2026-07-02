import { ClientesService } from './clientes.service';

/**
 * Testes de integração do serviço de Clientes — foco no endpoint de
 * autocompletar por CNPJ (buscarPorCnpj), usado na tela de Novo Orçamento.
 *
 * Estratégia: instanciamos o ClientesService diretamente com um PrismaService
 * "mockado" (apenas os métodos que o serviço usa). Assim os testes são rápidos,
 * rodam na CI sem banco Postgres e sem chamadas de rede reais — a consulta
 * pública (BrasilAPI/Receita) é mockada via o método privado getJson.
 */

// Tipo mínimo do prisma que o serviço consome nestes testes.
type PrismaMock = {
  cliente: {
    findFirst: jest.Mock;
  };
};

function criarPrismaMock(): PrismaMock {
  return {
    cliente: {
      findFirst: jest.fn(),
    },
  };
}

// Monta um registro de Cliente canônico com contatos (mais recente primeiro,
// pois o serviço faz orderBy createdAt desc / take 1).
function clienteCadastrado(overrides: Partial<any> = {}) {
  return {
    id: 'cli_1',
    cnpj: '11.222.333/0001-81',
    nome: 'Hospital Santa Clara',
    cep: '01310000',
    endereco: 'Avenida Paulista',
    numero: '1000',
    complemento: 'Sala 5',
    bairro: 'Bela Vista',
    cidade: 'São Paulo',
    estado: 'SP',
    pais: 'Brasil',
    contatos: [
      {
        nome: 'Maria Souza',
        setor: 'Compras',
        telefone: '11999990000',
        email: 'maria@santaclara.com',
        createdAt: new Date('2025-06-01'),
      },
    ],
    ...overrides,
  };
}

describe('ClientesService.buscarPorCnpj (integração)', () => {
  let prisma: PrismaMock;
  let service: ClientesService;

  beforeEach(() => {
    prisma = criarPrismaMock();
    // O construtor só espera algo no formato PrismaService; o mock basta.
    service = new ClientesService(prisma as any);
  });

  // ===== 1) CNPJ inexistente (14 dígitos válidos, fora do cadastro) =====
  it('retorna null quando o CNPJ não existe no cadastro nem na Receita', async () => {
    prisma.cliente.findFirst.mockResolvedValue(null);
    // Sem cadastro: a consulta pública também não encontra nada.
    const getJson = jest
      .spyOn(service as any, 'getJson')
      .mockResolvedValue(null);

    const resultado = await service.buscarPorCnpj('11.222.333/0001-81');

    expect(resultado).toBeNull();
    // Confirma que tentou o cadastro e depois a consulta pública.
    expect(prisma.cliente.findFirst).toHaveBeenCalledTimes(1);
    expect(getJson).toHaveBeenCalled();
  });

  // ===== 2) CNPJs malformados — devem retornar null cedo, sem tocar no banco =====
  describe('CNPJs malformados retornam null sem consultar o banco', () => {
    const casos: Array<[string, string]> = [
      ['string vazia', ''],
      ['apenas espaços', '   '],
      ['poucos dígitos', '123'],
      ['13 dígitos (um a menos)', '1122233300018'],
      ['15 dígitos (um a mais)', '112223330001810'],
      ['texto não numérico', 'abcdefghijklmn'],
      ['máscara incompleta', '11.222.333/0001'],
    ];

    it.each(casos)('%s → null', async (_descricao, entrada) => {
      const resultado = await service.buscarPorCnpj(entrada as string);
      expect(resultado).toBeNull();
      // Curto-circuito: nunca deve consultar o Prisma para entradas inválidas.
      expect(prisma.cliente.findFirst).not.toHaveBeenCalled();
    });

    it('trata null/undefined sem lançar exceção', async () => {
      await expect(
        service.buscarPorCnpj(null as any),
      ).resolves.toBeNull();
      await expect(
        service.buscarPorCnpj(undefined as any),
      ).resolves.toBeNull();
      expect(prisma.cliente.findFirst).not.toHaveBeenCalled();
    });
  });

  // ===== 3) CNPJ encontrado no cadastro — fonte 'cadastro' + endereço canônico =====
  it('retorna dados canônicos e do contato mais recente quando encontrado no cadastro', async () => {
    prisma.cliente.findFirst.mockResolvedValue(clienteCadastrado());
    const getJson = jest.spyOn(service as any, 'getJson');

    const r = await service.buscarPorCnpj('11.222.333/0001-81');

    expect(r).not.toBeNull();
    expect(r).toMatchObject({
      encontrado: true,
      fonte: 'cadastro',
      cnpj: '11.222.333/0001-81',
      empresa: 'Hospital Santa Clara',
      cep: '01310000',
      endereco: 'Avenida Paulista',
      enderecoNumero: '1000',
      complemento: 'Sala 5',
      bairro: 'Bela Vista',
      cidade: 'São Paulo',
      estado: 'SP',
      pais: 'Brasil',
      // dados do último solicitante
      solicitante: 'Maria Souza',
      setor: 'Compras',
      telefone: '11999990000',
      email: 'maria@santaclara.com',
    });
    // Encontrado no cadastro: NÃO deve consultar a Receita.
    expect(getJson).not.toHaveBeenCalled();
  });

  // ===== 4) Aceita CNPJ mascarado, só dígitos ou formatado =====
  describe('normalização da máscara do CNPJ', () => {
    const variacoes: Array<[string, string]> = [
      ['mascarado', '11.222.333/0001-81'],
      ['somente dígitos', '11222333000181'],
      ['formatado com espaços', ' 11.222.333/0001-81 '],
    ];

    it.each(variacoes)(
      'resolve o mesmo cliente para entrada %s',
      async (_desc, entrada) => {
        prisma.cliente.findFirst.mockResolvedValue(clienteCadastrado());

        const r = await service.buscarPorCnpj(entrada as string);

        expect(r).toMatchObject({ fonte: 'cadastro', empresa: 'Hospital Santa Clara' });
        // O where deve conter as três variantes (máscara, dígitos, formatado).
        const argsWhere = prisma.cliente.findFirst.mock.calls[0][0].where.OR;
        const cnpjsBuscados = argsWhere.map((o: any) => o.cnpj);
        expect(cnpjsBuscados).toContain('11222333000181'); // só dígitos
        expect(cnpjsBuscados).toContain('11.222.333/0001-81'); // formatado
      },
    );
  });

  // ===== 5) Edge case: mesma empresa com orçamentos de endereços diferentes =====
  // Como Cliente.cnpj é @unique, existe UM único registro Cliente por empresa.
  // O autocompletar SEMPRE devolve o endereço canônico do Cliente (determinístico),
  // independentemente dos snapshots de endereço armazenados em cada orçamento.
  // Além disso, entre vários contatos, vence o mais recente (createdAt desc).
  describe('autofill determinístico para a mesma empresa', () => {
    it('retorna o endereço canônico do Cliente, não snapshots de orçamentos divergentes', async () => {
      // Simula que o Cliente tem vários contatos; o Prisma já devolve apenas o
      // mais recente por causa do orderBy desc / take 1 no serviço.
      const cliente = clienteCadastrado({
        endereco: 'Rua Canônica Atual',
        numero: '250',
        cidade: 'Campinas',
        estado: 'SP',
        contatos: [
          {
            nome: 'João Recente',
            setor: 'Engenharia Clínica',
            telefone: '19988887777',
            email: 'joao@empresa.com',
            createdAt: new Date('2025-07-10'),
          },
        ],
      });
      prisma.cliente.findFirst.mockResolvedValue(cliente);

      const r = await service.buscarPorCnpj('11222333000181');

      // Endereço canônico — estável e determinístico.
      expect(r).toMatchObject({
        endereco: 'Rua Canônica Atual',
        enderecoNumero: '250',
        cidade: 'Campinas',
        // Contato mais recente vence.
        solicitante: 'João Recente',
        setor: 'Engenharia Clínica',
        telefone: '19988887777',
        email: 'joao@empresa.com',
      });
    });

    it('duas chamadas para a mesma empresa devolvem o mesmo endereço (idempotente)', async () => {
      prisma.cliente.findFirst.mockResolvedValue(clienteCadastrado());

      const r1 = await service.buscarPorCnpj('11.222.333/0001-81');
      const r2 = await service.buscarPorCnpj('11222333000181');

      expect(r1).toEqual(r2);
    });

    it('usa o pedido include de contato mais recente (orderBy desc, take 1)', async () => {
      prisma.cliente.findFirst.mockResolvedValue(clienteCadastrado());

      await service.buscarPorCnpj('11222333000181');

      const include = prisma.cliente.findFirst.mock.calls[0][0].include;
      expect(include.contatos).toEqual({
        orderBy: { createdAt: 'desc' },
        take: 1,
      });
    });

    it('lida com cliente sem nenhum contato (campos do solicitante vazios)', async () => {
      prisma.cliente.findFirst.mockResolvedValue(
        clienteCadastrado({ contatos: [] }),
      );

      const r = await service.buscarPorCnpj('11222333000181');

      expect(r).toMatchObject({
        fonte: 'cadastro',
        empresa: 'Hospital Santa Clara',
        solicitante: '',
        setor: '',
        telefone: '',
        email: '',
      });
    });
  });

  // ===== 6) Fallback para a consulta pública (fonte 'receita') =====
  describe('consulta pública quando não está no cadastro', () => {
    it('retorna fonte "receita" a partir da BrasilAPI', async () => {
      prisma.cliente.findFirst.mockResolvedValue(null);
      jest.spyOn(service as any, 'getJson').mockImplementation(async (url: unknown) => {
        if (typeof url === 'string' && url.includes('brasilapi.com.br')) {
          return {
            razao_social: 'Clínica Nova LTDA',
            nome_fantasia: 'Clínica Nova',
            cep: '13010-100',
            descricao_tipo_de_logradouro: 'Rua',
            logradouro: 'das Flores',
            numero: '42',
            complemento: 'Andar 2',
            bairro: 'Centro',
            municipio: 'Campinas',
            uf: 'SP',
            ddd_telefone_1: '1933334444',
            email: 'contato@clinicanova.com',
          };
        }
        return null;
      });

      const r = await service.buscarPorCnpj('11222333000181');

      expect(r).toMatchObject({
        encontrado: true,
        fonte: 'receita',
        cnpj: '11.222.333/0001-81',
        empresa: 'Clínica Nova',
        cep: '13010100',
        endereco: 'Rua das Flores',
        enderecoNumero: '42',
        bairro: 'Centro',
        cidade: 'Campinas',
        estado: 'SP',
        pais: 'Brasil',
        telefone: '1933334444',
        email: 'contato@clinicanova.com',
      });
    });

    it('faz fallback para ReceitaWS quando BrasilAPI e MinhaReceita falham', async () => {
      prisma.cliente.findFirst.mockResolvedValue(null);
      jest.spyOn(service as any, 'getJson').mockImplementation(async (url: unknown) => {
        if (typeof url === 'string' && url.includes('receitaws.com.br')) {
          return {
            status: 'OK',
            nome: 'Laboratório Vida',
            fantasia: '',
            cep: '20040-002',
            logradouro: 'Avenida Rio Branco',
            numero: '1',
            bairro: 'Centro',
            municipio: 'Rio de Janeiro',
            uf: 'RJ',
            telefone: '2122223333',
            email: 'lab@vida.com',
          };
        }
        return null; // BrasilAPI e MinhaReceita retornam null
      });

      const r = await service.buscarPorCnpj('11222333000181');

      expect(r).toMatchObject({
        fonte: 'receita',
        empresa: 'Laboratório Vida',
        cidade: 'Rio de Janeiro',
        estado: 'RJ',
      });
    });
  });
});
