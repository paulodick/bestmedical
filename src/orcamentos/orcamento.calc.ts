// ===== Cálculos oficiais do orçamento (fonte da verdade no servidor) =====
// Tudo em centavos (inteiro) para evitar erros de ponto flutuante.

export const reaisParaCentavos = (reais?: number): number =>
  Math.round((reais || 0) * 100);

export const centavosParaReais = (centavos?: number): number =>
  (centavos || 0) / 100;

export interface ItemCalc {
  quantidade: number;
  valorItemCentavos: number;
}

// Subtotal = Σ(quantidade × valorItem)
export const calcSubtotal = (itens: ItemCalc[]): number =>
  itens.reduce(
    (acc, it) => acc + (it.quantidade || 0) * (it.valorItemCentavos || 0),
    0,
  );

// Desconto em centavos a partir do percentual
export const calcDesconto = (subtotal: number, percent: number): number =>
  Math.round(subtotal * ((percent || 0) / 100));

export interface TotaisCalc {
  subtotalCentavos: number;
  descontoCentavos: number;
  totalCentavos: number;
}

export const calcTotais = (itens: ItemCalc[], descontoPercent: number): TotaisCalc => {
  const subtotalCentavos = calcSubtotal(itens);
  const descontoCentavos = calcDesconto(subtotalCentavos, descontoPercent);
  return {
    subtotalCentavos,
    descontoCentavos,
    totalCentavos: subtotalCentavos - descontoCentavos,
  };
};

// Soma N dias corridos a uma data ISO yyyy-mm-dd
export const addDias = (iso: string, dias: number): string => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '';
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + dias);
  return dt.toISOString().slice(0, 10);
};

// Divide um total igualmente entre n parcelas (resíduo na última)
export const distribuirIgual = (total: number, n: number): number[] => {
  if (n <= 0) return [];
  const base = Math.floor(total / n);
  const valores = Array(n).fill(base);
  valores[n - 1] = total - base * (n - 1);
  return valores;
};

export interface ParcelaCalc {
  numero: number;
  data: string; // ISO ou ''
  valorCentavos: number;
  pago?: boolean;
}

// Normaliza as parcelas garantindo a invariante Σ = total.
// - Renumera 1..n
// - Datas: a partir da 1ª, +30 dias acumulado quando a seguinte estiver vazia
// - Valores: respeita os informados; se a soma não fechar, redistribui o
//   restante igualmente entre as parcelas sem valor (ou na última).
export const normalizarParcelas = (
  parcelas: ParcelaCalc[],
  numParcelas: number,
  totalCentavos: number,
): ParcelaCalc[] => {
  const n = Math.max(1, Math.floor(numParcelas || 1));
  const base = parcelas.slice(0, n);
  // completa linhas faltantes
  while (base.length < n) {
    base.push({ numero: base.length + 1, data: '', valorCentavos: 0 });
  }

  // renumera e ajusta datas
  for (let i = 0; i < n; i++) {
    base[i].numero = i + 1;
    if (i > 0 && !base[i].data && base[i - 1].data) {
      base[i].data = addDias(base[i - 1].data, 30);
    }
  }

  // valores: se todos zerados, divide igual; senão respeita e ajusta resíduo
  const somaInformada = base.reduce((a, p) => a + (p.valorCentavos || 0), 0);
  if (somaInformada === 0) {
    const vals = distribuirIgual(totalCentavos, n);
    base.forEach((p, i) => (p.valorCentavos = vals[i]));
  } else if (somaInformada !== totalCentavos) {
    // ajusta a diferença na última parcela para fechar a invariante
    const diff = totalCentavos - somaInformada;
    base[n - 1].valorCentavos = (base[n - 1].valorCentavos || 0) + diff;
  }

  return base;
};
