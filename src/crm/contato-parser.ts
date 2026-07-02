// ===================================================================
// Inteligência de separação de contatos do CRM.
//
// Padrão de cadastro do usuário:
//   [EMPRESA / ONDE CONHEÇO] + [Nome e Sobrenome da pessoa]
//   ex.: "Abeclin Bruno Roma"  -> empresa="Abeclin", nome="Bruno Roma"
//        "Adm Hospital Azambuja Evandro" -> empresa="Adm Hospital Azambuja",
//                                           nome="Evandro"
//
// Regras (modo AGRESSIVO — sempre tenta separar):
//  1) Se o vCard/CSV já trouxe uma EMPRESA (ORG) dedicada, respeita.
//  2) Detecta onde começa o NOME DA PESSOA: a 1ª palavra que for um primeiro
//     nome próprio conhecido. Tudo ANTES vira Empresa; do nome em diante, Nome.
//  3) Se não achar nenhum primeiro nome conhecido, cai no fallback agressivo:
//     1ª palavra = Empresa, resto = Nome (quando há 2+ palavras).
//
// Além disso: cruza o DDD do telefone e/ou a cidade/UF citada no texto para
// preencher Cidade e Estado. Cidade preenche o estado automaticamente; cidade
// que existe em mais de uma UF deixa o estado em branco (ajuste manual).
// ===================================================================

export interface ContatoSeparado {
  nome: string;
  empresa: string | null;
  cidade: string | null;
  estado: string | null;
}

export function removerAcentos(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function norm(s: string): string {
  return removerAcentos((s || '').toLowerCase()).trim();
}

// ===================== DDD -> UF (Brasil) =====================
const DDD_UF: Record<string, string> = {
  '11': 'SP', '12': 'SP', '13': 'SP', '14': 'SP', '15': 'SP', '16': 'SP',
  '17': 'SP', '18': 'SP', '19': 'SP',
  '21': 'RJ', '22': 'RJ', '24': 'RJ',
  '27': 'ES', '28': 'ES',
  '31': 'MG', '32': 'MG', '33': 'MG', '34': 'MG', '35': 'MG', '37': 'MG', '38': 'MG',
  '41': 'PR', '42': 'PR', '43': 'PR', '44': 'PR', '45': 'PR', '46': 'PR',
  '47': 'SC', '48': 'SC', '49': 'SC',
  '51': 'RS', '53': 'RS', '54': 'RS', '55': 'RS',
  '61': 'DF', '62': 'GO', '64': 'GO', '63': 'TO',
  '65': 'MT', '66': 'MT', '67': 'MS',
  '68': 'AC', '69': 'RO',
  '71': 'BA', '73': 'BA', '74': 'BA', '75': 'BA', '77': 'BA',
  '79': 'SE',
  '81': 'PE', '87': 'PE',
  '82': 'AL', '83': 'PB', '84': 'RN', '85': 'CE', '88': 'CE',
  '86': 'PI', '89': 'PI',
  '91': 'PA', '93': 'PA', '94': 'PA',
  '92': 'AM', '97': 'AM',
  '95': 'RR', '96': 'AP', '98': 'MA', '99': 'MA',
};

// Extrai o DDD (2 dígitos) de um telefone brasileiro, tolerando +55, espaços,
// parênteses, traços e o 0 de operadora. Retorna null se não parecer BR.
export function extrairDDD(telefone?: string | null): string | null {
  if (!telefone) return null;
  const bruto = (telefone || '').trim();
  let d = bruto.replace(/\D/g, '');
  if (!d) return null;

  // Número internacional explícito com prefixo + e código de país != 55
  // (ex.: +1..., +34...) NÃO é brasileiro: não deve virar DDD/UF.
  if (bruto.startsWith('+') && !d.startsWith('55')) return null;

  // Remove código do país 55, se presente com tamanho compatível.
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  // Remove 0 de DDD interurbano/operadora (ex.: 011...).
  if (d.startsWith('0') && d.length >= 11) d = d.slice(1);
  // Depois de limpar, número BR válido tem 10 (fixo) ou 11 (celular) dígitos.
  // Mais que isso normalmente é número estrangeiro sem + — não confiável.
  if (d.length < 10 || d.length > 11) return null;
  const ddd = d.slice(0, 2);
  return DDD_UF[ddd] ? ddd : null;
}

export function ufDoTelefone(telefone?: string | null): string | null {
  const ddd = extrairDDD(telefone);
  return ddd ? DDD_UF[ddd] : null;
}

// ===================== UF: siglas e nomes =====================
const UFS = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
]);

// Nome do estado (normalizado, sem acento) -> UF.
const NOME_UF: Record<string, string> = {
  acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA',
  ceara: 'CE', 'distrito federal': 'DF', 'espirito santo': 'ES', goias: 'GO',
  maranhao: 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS',
  'minas gerais': 'MG', para: 'PA', paraiba: 'PB', parana: 'PR',
  pernambuco: 'PE', piaui: 'PI', 'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondonia: 'RO',
  roraima: 'RR', 'santa catarina': 'SC', 'sao paulo': 'SP', sergipe: 'SE',
  tocantins: 'TO',
};

// ===================== Cidade -> UF =====================
// Cidades comuns em agendas comerciais. Valor null = cidade existe em várias
// UFs (ambígua) -> preenche cidade mas deixa estado em branco (ajuste manual).
// Chaves normalizadas (minúsculas sem acento).
const CIDADE_UF: Record<string, string | null> = {
  'sao paulo': 'SP', campinas: 'SP', santos: 'SP', guarulhos: 'SP',
  osasco: 'SP', 'sao bernardo': 'SP', 'santo andre': 'SP', jundiai: 'SP',
  sorocaba: 'SP', ribeirao: 'SP', 'ribeirao preto': 'SP', bauru: 'SP',
  piracicaba: 'SP', 'sao jose do rio preto': 'SP', 'sao jose dos campos': 'SP',
  marilia: 'SP', presidente: null, aracatuba: 'SP', franca: 'SP',
  'rio de janeiro': 'RJ', niteroi: 'RJ', 'nova iguacu': 'RJ',
  'duque de caxias': 'RJ', campos: null, petropolis: 'RJ', volta: null,
  'volta redonda': 'RJ', macae: 'RJ', angra: 'RJ',
  'belo horizonte': 'MG', contagem: 'MG', uberlandia: 'MG', juiz: null,
  'juiz de fora': 'MG', betim: 'MG', montes: null, 'montes claros': 'MG',
  uberaba: 'MG', divinopolis: 'MG', ipatinga: 'MG', pocos: null,
  'pocos de caldas': 'MG',
  curitiba: 'PR', londrina: 'PR', maringa: 'PR', 'ponta grossa': 'PR',
  cascavel: null, 'foz do iguacu': 'PR', 'sao jose dos pinhais': 'PR',
  'porto alegre': 'RS', caxias: null, 'caxias do sul': 'RS', pelotas: 'RS',
  canoas: 'RS', 'santa maria': null, gravatai: 'RS', novo: null,
  'novo hamburgo': 'RS',
  florianopolis: 'SC', joinville: 'SC', blumenau: 'SC', chapeco: 'SC',
  criciuma: 'SC', itajai: 'SC', 'balneario camboriu': 'SC',
  salvador: 'BA', 'feira de santana': 'BA', 'vitoria da conquista': 'BA',
  camacari: 'BA', juazeiro: null, ilheus: 'BA', itabuna: 'BA',
  recife: 'PE', jaboatao: 'PE', olinda: 'PE', caruaru: 'PE', petrolina: 'PE',
  fortaleza: 'CE', 'juazeiro do norte': 'CE', sobral: 'CE', maracanau: 'CE',
  arapiraca: 'AL', maceio: 'AL',
  'joao pessoa': 'PB', 'campina grande': 'PB',
  natal: 'RN', mossoro: 'RN',
  teresina: 'PI', parnaiba: 'PI',
  'sao luis': 'MA', imperatriz: 'MA',
  aracaju: 'SE',
  goiania: 'GO', anapolis: 'GO', 'aparecida de goiania': 'GO',
  brasilia: 'DF',
  cuiaba: 'MT', 'varzea grande': 'MT', rondonopolis: 'MT',
  'campo grande': 'MS', dourados: 'MS',
  belem: 'PA', ananindeua: 'PA', santarem: null, maraba: 'PA',
  manaus: 'AM',
  vitoria: 'ES', vila: null, 'vila velha': 'ES', serra: null,
  'cariacica': 'ES',
  'porto velho': 'RO', 'rio branco': 'AC', 'boa vista': 'RR', macapa: 'AP',
  palmas: null,
};

// Frases de cidade que têm 2/3 palavras (procuramos como sequência).
const CIDADES_MULTI = Object.keys(CIDADE_UF)
  .filter((c) => c.includes(' '))
  .sort((a, b) => b.length - a.length); // mais longas primeiro

// ===================== Primeiros nomes próprios =====================
export const PRIMEIROS_NOMES = new Set<string>([
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
  'evandro', 'wagner', 'wilson', 'nelson', 'osvaldo', 'valdir', 'gilberto',
  'gilmar', 'reginaldo', 'ronaldo', 'rogerio', 'sandro', 'cristiano',
  'douglas', 'elias', 'fabiano', 'fernanda', 'flavio', 'geraldo', 'hugo',
  'ivan', 'jackson', 'jair', 'kleber', 'lucio', 'marcio', 'nilson', 'orlando',
  'oswaldo', 'rafaela', 'ramon', 'ronaldo', 'saulo', 'silvio', 'vagner',
  'valdemar', 'valter', 'walter', 'washington', 'wellington', 'wanderley',
  'juliana', 'patricia', 'aline', 'amanda', 'bruna', 'camila',
  'carla', 'carolina', 'beatriz', 'jessica', 'leticia', 'larissa', 'mariana',
  'gabriela', 'vanessa', 'vivian', 'tatiane', 'tatiana', 'sandra',
  'simone', 'sonia', 'rita', 'rosa', 'rosana', 'cristina', 'cristiane',
  'daniela', 'debora', 'eliane', 'fabiana', 'flavia', 'helena', 'isabela',
  'isabella', 'julia', 'laura', 'luana', 'lucia', 'luciana', 'marcia',
  'marta', 'monica', 'natalia', 'priscila', 'renata', 'sabrina', 'sara',
  'sarah', 'silvia', 'tania', 'teresa', 'thais', 'valeria', 'viviane',
  'alice', 'cecilia', 'clara', 'emilly', 'manuela', 'sofia', 'sophia',
  'valentina', 'lara', 'livia', 'agatha', 'elaine', 'kelly', 'jaqueline',
  'angela', 'aparecida', 'regina', 'roberta', 'denise', 'eliana', 'graziela',
  'adriana', 'alessandra', 'andrea', 'bianca', 'claudia', 'daiane', 'edna',
  'elisangela', 'gisele', 'ingrid', 'ivone', 'joana', 'katia', 'luciene',
  'marilene', 'nadia', 'raquel', 'rosangela', 'suely', 'vera', 'wania',
]);

// Termos que claramente NÃO são nome de pessoa (reforçam parte "empresa").
const TERMOS_EMPRESA = new Set<string>([
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
  'advogados', 'associados', 'ltda', 'eireli', 'mei', 'epp', 'cia',
  'adm', 'administracao', 'grupo', 'rede', 'sistema', 'santa', 'sao',
  'santo', 'nossa', 'senhora',
]);

// Prefixos/títulos que pertencem à PESSOA (não à empresa).
const TITULOS_PESSOA = new Set<string>(['dr', 'dra', 'sr', 'sra', 'prof', 'profa']);

// ===================== Detecção de cidade/UF no texto =====================
function detectarCidadeEstado(
  palavrasNorm: string[],
  palavrasOrig: string[],
  ufTelefone: string | null,
): { cidade: string | null; estado: string | null; indicesUsados: Set<number> } {
  const usados = new Set<number>();
  let cidade: string | null = null;
  let estadoCidade: string | null | undefined = undefined;

  // 1) Cidades com múltiplas palavras (sequência).
  const textoNorm = palavrasNorm.join(' ');
  for (const c of CIDADES_MULTI) {
    const idx = textoNorm.indexOf(c);
    if (idx >= 0) {
      // Marca índices das palavras que compõem a cidade.
      const antes = textoNorm.slice(0, idx).trim();
      const start = antes ? antes.split(' ').length : 0;
      const qtd = c.split(' ').length;
      for (let i = start; i < start + qtd && i < palavrasOrig.length; i++) {
        usados.add(i);
      }
      cidade = tituloDe(palavrasOrig.slice(start, start + qtd).join(' '));
      estadoCidade = CIDADE_UF[c];
      break;
    }
  }

  // 2) Cidade de uma palavra.
  if (!cidade) {
    for (let i = 0; i < palavrasNorm.length; i++) {
      const p = palavrasNorm[i];
      if (Object.prototype.hasOwnProperty.call(CIDADE_UF, p)) {
        cidade = tituloDe(palavrasOrig[i]);
        estadoCidade = CIDADE_UF[p];
        usados.add(i);
        break;
      }
    }
  }

  // 3) UF explícita no texto (sigla de 2 letras ou nome do estado).
  let estadoTexto: string | null = null;
  for (let i = 0; i < palavrasOrig.length; i++) {
    const up = removerAcentos(palavrasOrig[i]).toUpperCase();
    if (UFS.has(up)) {
      estadoTexto = up;
      usados.add(i);
      break;
    }
  }
  if (!estadoTexto) {
    for (const [nomeEstado, uf] of Object.entries(NOME_UF)) {
      if (textoNorm.includes(nomeEstado)) {
        estadoTexto = uf;
        break;
      }
    }
  }

  // Resolve o estado final:
  // - cidade não-ambígua -> usa a UF da cidade.
  // - cidade ambígua (null): tenta UF do texto; senão UF do telefone.
  // - sem cidade, com UF no texto -> usa UF do texto.
  // - por fim, UF do telefone como reforço (nunca sobrescreve UF de cidade).
  let estado: string | null = null;
  if (cidade) {
    if (estadoCidade) estado = estadoCidade;
    else estado = estadoTexto || ufTelefone || null; // ambígua
  } else {
    estado = estadoTexto || null;
  }
  if (!estado && ufTelefone) estado = ufTelefone;

  return { cidade, estado, indicesUsados: usados };
}

function tituloDe(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

// ===================== Separação principal =====================
export function separarContato(
  textoBruto: string,
  empresaExistente: string | null | undefined,
  telefone?: string | null,
): ContatoSeparado {
  const texto = (textoBruto || '').trim();
  const ufTel = ufDoTelefone(telefone);

  if (!texto) {
    return { nome: '', empresa: empresaExistente?.trim() || null, cidade: null, estado: ufTel };
  }

  const palavrasOrig = texto.split(/\s+/).filter(Boolean);
  const palavrasNorm = palavrasOrig.map(norm);

  // Detecta cidade/UF (e quais palavras foram "consumidas" pela cidade).
  const { cidade, estado, indicesUsados } = detectarCidadeEstado(
    palavrasNorm,
    palavrasOrig,
    ufTel,
  );

  // Se já veio empresa dedicada (ORG), o texto inteiro é o nome da pessoa.
  if (empresaExistente && empresaExistente.trim()) {
    const restante = palavrasOrig.filter((_, i) => !indicesUsados.has(i));
    return {
      nome: restante.join(' ').trim() || texto,
      empresa: empresaExistente.trim(),
      cidade,
      estado,
    };
  }

  // Índice onde começa o nome da pessoa: 1ª palavra que é primeiro nome
  // conhecido E que não foi consumida pela cidade. Um título (Dr/Dra/Sr...)
  // imediatamente antes do primeiro nome também entra no nome da pessoa.
  let idxNome = -1;
  for (let i = 0; i < palavrasNorm.length; i++) {
    if (indicesUsados.has(i)) continue;
    if (PRIMEIROS_NOMES.has(palavrasNorm[i])) {
      idxNome = i;
      // Recua para incluir títulos (dr, dra...) que precedem o nome.
      while (
        idxNome - 1 >= 0 &&
        !indicesUsados.has(idxNome - 1) &&
        TITULOS_PESSOA.has(palavrasNorm[idxNome - 1])
      ) {
        idxNome--;
      }
      break;
    }
  }

  let empresaTokens: string[] = [];
  let nomeTokens: string[] = [];

  if (idxNome >= 0) {
    // Tudo antes do 1º nome -> empresa; do nome em diante -> nome da pessoa.
    empresaTokens = palavrasOrig.slice(0, idxNome);
    nomeTokens = palavrasOrig.slice(idxNome);
  } else {
    // Sem primeiro nome conhecido. SÓ separa empresa/nome quando existe um
    // termo claro de empresa no texto; caso contrário mantém tudo como nome
    // (evita quebrar razões sociais como "Academia Octógono", "Ademir Elétrica").
    const restante = palavrasOrig.filter((_, i) => !indicesUsados.has(i));
    // Entidade única (empresa OU pessoa sem primeiro nome mapeado): mantém o
    // texto inteiro no campo nome e deixa empresa em branco. Não inventamos
    // uma separação que pode estar errada.
    nomeTokens = restante;
  }

  // Remove tokens de cidade da parte de empresa e de nome (já viraram cidade).
  const semCidade = (arr: string[], offset: number) =>
    arr.filter((_, i) => !indicesUsados.has(i + offset));
  empresaTokens = semCidade(empresaTokens, 0);
  nomeTokens = semCidade(nomeTokens, idxNome >= 0 ? idxNome : 0);

  let empresa = empresaTokens.join(' ').trim() || null;
  let nome = nomeTokens.join(' ').trim();

  // Segurança: nunca deixa o nome vazio. Se ficou vazio, usa a empresa como
  // nome (ou o texto original).
  if (!nome) {
    nome = empresa || texto;
    if (empresa === nome) empresa = null;
  }

  return { nome, empresa, cidade, estado };
}
