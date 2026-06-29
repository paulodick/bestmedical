// ===== Detecção e replicação das customizações das condições do contrato =====
// Fonte de verdade da lógica (o frontend espelha a mesma em src/lib/contrato.ts).
//
// Ideia geral:
//  1. Comparamos linha a linha o texto editado das condições (`condicoes`)
//     contra o texto padrão de referência (`condicoesPadrao`).
//  2. Cada diferença vira uma linha legível (alterada/adicionada/removida).
//  3. Essas linhas são injetadas no campo de Observações Internas, dentro de um
//     bloco delimitado por marcadores, para que possam ser regeneradas sem
//     apagar as anotações manuais que o usuário tenha escrito fora do bloco.
//  4. Se não houver diferença, o bloco é removido (preservando o texto manual).

export const MARCADOR_INICIO =
  '===== CUSTOMIZAÇÕES DAS CONDIÇÕES (automático) =====';
export const MARCADOR_FIM = '===== FIM DAS CUSTOMIZAÇÕES =====';

// Data no formato dd/mm/aaaa (pt-BR), para datar o registro das customizações.
function dataBRHoje(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// Diff linha a linha entre o texto atual e o padrão. Retorna uma lista de
// descrições legíveis das diferenças encontradas. Determinístico (mesma saída
// no front e no back para as mesmas entradas).
export function diffCondicoes(atual: string, padrao: string): string[] {
  const linhasAtual = (atual ?? '').split('\n');
  const linhasPadrao = (padrao ?? '').split('\n');
  const total = Math.max(linhasAtual.length, linhasPadrao.length);

  const mudancas: string[] = [];
  for (let i = 0; i < total; i++) {
    const a = linhasAtual[i];
    const p = linhasPadrao[i];

    if (a !== undefined && p !== undefined) {
      // Ambas existem: registra apenas se forem diferentes.
      if (a !== p) {
        mudancas.push(`Linha ${i + 1} alterada: "${a}" (padrão: "${p}")`);
      }
    } else if (a !== undefined) {
      // Só a atual existe → linha adicionada em relação ao padrão.
      mudancas.push(`Linha ${i + 1} adicionada: "${a}"`);
    } else if (p !== undefined) {
      // Só o padrão existe → linha removida em relação ao padrão.
      mudancas.push(`Linha ${i + 1} removida (padrão: "${p}")`);
    }
  }
  return mudancas;
}

// Remove o bloco automático (entre marcadores) preservando o texto manual.
function removerBloco(texto: string): string {
  const ini = texto.indexOf(MARCADOR_INICIO);
  if (ini === -1) return texto.trim();

  const fimIdx = texto.indexOf(MARCADOR_FIM, ini);
  if (fimIdx === -1) {
    // Marcador de fim ausente (texto corrompido): remove do início até o final.
    return texto.slice(0, ini).replace(/\s+$/, '').trim();
  }

  const antes = texto.slice(0, ini).replace(/\s+$/, '');
  const depois = texto
    .slice(fimIdx + MARCADOR_FIM.length)
    .replace(/^\s+/, '');
  return [antes, depois].filter(Boolean).join('\n\n').trim();
}

// Gera o conteúdo final das Observações Internas:
//  - preserva o texto manual (fora dos marcadores);
//  - injeta/atualiza o bloco de customizações quando houver diferenças;
//  - remove o bloco quando não houver diferença.
export function gerarObservacoesComCustomizacoes(
  condicoes: string,
  condicoesPadrao: string,
  observacoesAtuais: string,
): string {
  const manual = removerBloco(observacoesAtuais ?? '');
  const mudancas = diffCondicoes(condicoes ?? '', condicoesPadrao ?? '');

  if (mudancas.length === 0) {
    // Sem diferenças: mantém apenas as anotações manuais.
    return manual;
  }

  const bloco = [
    MARCADOR_INICIO,
    `Customizações registradas em ${dataBRHoje()}:`,
    ...mudancas,
    MARCADOR_FIM,
  ].join('\n');

  return manual ? `${manual}\n\n${bloco}` : bloco;
}
