/**
 * Testes unitários da lógica financeira do serviço de orçamentos.
 *
 * Estes testes protegem os cálculos monetários (fonte da verdade no servidor)
 * contra regressões futuras. Cobrem:
 *   - Conversão reais <-> centavos (evita erros de ponto flutuante)
 *   - Subtotal (Σ quantidade × valor)
 *   - Desconto percentual
 *   - Totais consolidados (subtotal - desconto)
 *   - Total manual (override) e sua interação com as parcelas
 *   - Distribuição de parcelas e a INVARIANTE Σ(parcelas) = total
 *
 * Tudo em centavos (inteiro) — nunca comparar valores em reais com floats.
 */
import {
  reaisParaCentavos,
  centavosParaReais,
  calcSubtotal,
  calcDesconto,
  calcTotais,
  distribuirIgual,
  normalizarParcelas,
  addDias,
  ItemCalc,
  ParcelaCalc,
} from './orcamento.calc';

// ===== Conversão reais <-> centavos =====
describe('reaisParaCentavos / centavosParaReais', () => {
  it('converte reais para centavos arredondando corretamente', () => {
    expect(reaisParaCentavos(100)).toBe(10000);
    expect(reaisParaCentavos(1.99)).toBe(199);
    expect(reaisParaCentavos(0)).toBe(0);
  });

  it('trata undefined/ausente como zero', () => {
    expect(reaisParaCentavos(undefined)).toBe(0);
    expect(reaisParaCentavos()).toBe(0);
  });

  it('evita o clássico erro de ponto flutuante (0.1 + 0.2)', () => {
    // 0.1 + 0.2 = 0.30000000000000004 em float; deve virar 30 centavos exatos.
    expect(reaisParaCentavos(0.1 + 0.2)).toBe(30);
    // 19,99 * 3 = 59,97 -> 5997 centavos
    expect(reaisParaCentavos(19.99 * 3)).toBe(5997);
  });

  it('centavosParaReais é o inverso e trata ausência como zero', () => {
    expect(centavosParaReais(10000)).toBe(100);
    expect(centavosParaReais(199)).toBe(1.99);
    expect(centavosParaReais(undefined)).toBe(0);
  });

  it('faz o round-trip reais -> centavos -> reais sem perda', () => {
    for (const reais of [0, 1, 1.99, 157000, 250.5, 9999.99]) {
      expect(centavosParaReais(reaisParaCentavos(reais))).toBeCloseTo(reais, 2);
    }
  });
});

// ===== Subtotal =====
describe('calcSubtotal', () => {
  it('soma quantidade × valor de cada item (em centavos)', () => {
    const itens: ItemCalc[] = [
      { quantidade: 2, valorItemCentavos: 5000 }, // 100,00
      { quantidade: 1, valorItemCentavos: 2500 }, // 25,00
    ];
    expect(calcSubtotal(itens)).toBe(12500); // 125,00
  });

  it('retorna 0 para lista vazia', () => {
    expect(calcSubtotal([])).toBe(0);
  });

  it('trata quantidade/valor ausentes como zero', () => {
    const itens = [
      { quantidade: 0, valorItemCentavos: 5000 },
      { quantidade: 3, valorItemCentavos: 0 },
      {} as ItemCalc,
    ];
    expect(calcSubtotal(itens)).toBe(0);
  });

  it('lida com quantidades grandes sem overflow indevido', () => {
    const itens: ItemCalc[] = [{ quantidade: 1000, valorItemCentavos: 19000000 }];
    expect(calcSubtotal(itens)).toBe(19000000000); // R$ 190.000.000,00
  });
});

// ===== Desconto =====
describe('calcDesconto', () => {
  it('calcula desconto percentual e arredonda para centavos', () => {
    expect(calcDesconto(10000, 10)).toBe(1000); // 10% de 100,00 = 10,00
    expect(calcDesconto(12500, 20)).toBe(2500); // 20% de 125,00 = 25,00
  });

  it('desconto de 0% é zero', () => {
    expect(calcDesconto(12500, 0)).toBe(0);
  });

  it('percentual ausente é tratado como zero', () => {
    expect(calcDesconto(12500, undefined as unknown as number)).toBe(0);
  });

  it('arredonda meio centavo corretamente', () => {
    // 33,33% de 100,00 = 33,33 -> 3333 centavos (Math.round de 3333)
    expect(calcDesconto(10000, 33.33)).toBe(3333);
    // 15% de 199 centavos = 29,85 -> arredonda para 30
    expect(calcDesconto(199, 15)).toBe(30);
  });

  it('desconto de 100% zera o valor', () => {
    expect(calcDesconto(12500, 100)).toBe(12500);
  });
});

// ===== Totais consolidados =====
describe('calcTotais', () => {
  it('consolida subtotal, desconto e total', () => {
    const itens: ItemCalc[] = [
      { quantidade: 2, valorItemCentavos: 5000 },
      { quantidade: 1, valorItemCentavos: 2500 },
    ];
    const t = calcTotais(itens, 10);
    expect(t.subtotalCentavos).toBe(12500);
    expect(t.descontoCentavos).toBe(1250);
    expect(t.totalCentavos).toBe(11250);
  });

  it('total = subtotal quando não há desconto', () => {
    const t = calcTotais([{ quantidade: 3, valorItemCentavos: 10000 }], 0);
    expect(t.subtotalCentavos).toBe(30000);
    expect(t.descontoCentavos).toBe(0);
    expect(t.totalCentavos).toBe(30000);
  });

  it('mantém a identidade total = subtotal - desconto', () => {
    const itens: ItemCalc[] = [
      { quantidade: 7, valorItemCentavos: 12345 },
      { quantidade: 3, valorItemCentavos: 6789 },
    ];
    const t = calcTotais(itens, 17.5);
    expect(t.totalCentavos).toBe(t.subtotalCentavos - t.descontoCentavos);
  });

  it('orçamento vazio resulta em tudo zero', () => {
    const t = calcTotais([], 25);
    expect(t).toEqual({
      subtotalCentavos: 0,
      descontoCentavos: 0,
      totalCentavos: 0,
    });
  });
});

// ===== Distribuição igual (base das parcelas) =====
describe('distribuirIgual', () => {
  it('divide igualmente quando o total é divisível', () => {
    expect(distribuirIgual(30000, 3)).toEqual([10000, 10000, 10000]);
  });

  it('coloca o resíduo (centavos) na última parcela', () => {
    // 100,00 em 3 -> 33,33 + 33,33 + 33,34
    expect(distribuirIgual(10000, 3)).toEqual([3333, 3333, 3334]);
  });

  it('parcela única recebe o total inteiro', () => {
    expect(distribuirIgual(15700000, 1)).toEqual([15700000]);
  });

  it('retorna vazio para n <= 0', () => {
    expect(distribuirIgual(10000, 0)).toEqual([]);
    expect(distribuirIgual(10000, -2)).toEqual([]);
  });

  it('a soma das parcelas sempre fecha exatamente o total', () => {
    for (const [total, n] of [
      [10000, 3],
      [99999, 7],
      [15700000, 12],
      [1, 4],
    ] as [number, number][]) {
      const soma = distribuirIgual(total, n).reduce((a, b) => a + b, 0);
      expect(soma).toBe(total);
    }
  });
});

// ===== addDias (datas das parcelas) =====
describe('addDias', () => {
  it('soma dias corridos a uma data ISO', () => {
    expect(addDias('2026-01-01', 30)).toBe('2026-01-31');
    expect(addDias('2026-01-15', 30)).toBe('2026-02-14');
  });

  it('atravessa a virada de mês e ano corretamente', () => {
    expect(addDias('2026-12-20', 30)).toBe('2027-01-19');
  });

  it('retorna string vazia para entrada inválida', () => {
    expect(addDias('', 30)).toBe('');
    expect(addDias('data-invalida', 30)).toBe('');
  });
});

// ===== Normalização de parcelas (INVARIANTE crítica) =====
describe('normalizarParcelas', () => {
  it('divide igualmente quando nenhuma parcela tem valor informado', () => {
    const out = normalizarParcelas([], 3, 30000);
    expect(out).toHaveLength(3);
    expect(out.map((p) => p.valorCentavos)).toEqual([10000, 10000, 10000]);
    expect(out.map((p) => p.numero)).toEqual([1, 2, 3]);
  });

  it('completa linhas faltantes até numParcelas', () => {
    const entrada: ParcelaCalc[] = [
      { numero: 1, data: '2026-01-01', valorCentavos: 0 },
    ];
    const out = normalizarParcelas(entrada, 4, 40000);
    expect(out).toHaveLength(4);
  });

  it('renumera as parcelas de 1..n', () => {
    const entrada: ParcelaCalc[] = [
      { numero: 5, data: '', valorCentavos: 0 },
      { numero: 9, data: '', valorCentavos: 0 },
    ];
    const out = normalizarParcelas(entrada, 2, 20000);
    expect(out.map((p) => p.numero)).toEqual([1, 2]);
  });

  it('preenche datas a +30 dias quando a seguinte está vazia', () => {
    const entrada: ParcelaCalc[] = [
      { numero: 1, data: '2026-01-01', valorCentavos: 0 },
      { numero: 2, data: '', valorCentavos: 0 },
      { numero: 3, data: '', valorCentavos: 0 },
    ];
    const out = normalizarParcelas(entrada, 3, 30000);
    expect(out.map((p) => p.data)).toEqual([
      '2026-01-01',
      '2026-01-31',
      '2026-03-02',
    ]);
  });

  it('respeita datas já informadas e não as sobrescreve', () => {
    const entrada: ParcelaCalc[] = [
      { numero: 1, data: '2026-01-01', valorCentavos: 0 },
      { numero: 2, data: '2026-06-15', valorCentavos: 0 },
    ];
    const out = normalizarParcelas(entrada, 2, 20000);
    expect(out[1].data).toBe('2026-06-15');
  });

  it('ajusta o resíduo na última parcela quando a soma informada não fecha', () => {
    const entrada: ParcelaCalc[] = [
      { numero: 1, data: '', valorCentavos: 10000 },
      { numero: 2, data: '', valorCentavos: 10000 },
    ];
    // total é 25000, informado soma 20000 -> diferença 5000 na última
    const out = normalizarParcelas(entrada, 2, 25000);
    expect(out.map((p) => p.valorCentavos)).toEqual([10000, 15000]);
  });

  it('ajusta para baixo quando a soma informada excede o total', () => {
    const entrada: ParcelaCalc[] = [
      { numero: 1, data: '', valorCentavos: 20000 },
      { numero: 2, data: '', valorCentavos: 20000 },
    ];
    // total 30000, informado 40000 -> última recebe -10000 de ajuste = 10000
    const out = normalizarParcelas(entrada, 2, 30000);
    expect(out.map((p) => p.valorCentavos)).toEqual([20000, 10000]);
  });

  it('força ao menos 1 parcela mesmo com numParcelas inválido', () => {
    expect(normalizarParcelas([], 0, 10000)).toHaveLength(1);
    expect(normalizarParcelas([], -3, 10000)).toHaveLength(1);
  });

  it('trunca parcelas em excesso para numParcelas', () => {
    const entrada: ParcelaCalc[] = [
      { numero: 1, data: '', valorCentavos: 0 },
      { numero: 2, data: '', valorCentavos: 0 },
      { numero: 3, data: '', valorCentavos: 0 },
    ];
    const out = normalizarParcelas(entrada, 2, 20000);
    expect(out).toHaveLength(2);
  });

  // A invariante mais importante: as parcelas SEMPRE somam o total.
  it('INVARIANTE: Σ(parcelas) === total em vários cenários', () => {
    const cenarios: [ParcelaCalc[], number, number][] = [
      [[], 3, 10000],
      [[], 7, 99999],
      [[], 12, 15700000],
      [
        [
          { numero: 1, data: '', valorCentavos: 3000 },
          { numero: 2, data: '', valorCentavos: 3000 },
        ],
        3,
        10000,
      ],
      [
        [{ numero: 1, data: '', valorCentavos: 50000 }],
        2,
        30000,
      ],
    ];
    for (const [parcelas, n, total] of cenarios) {
      const out = normalizarParcelas(parcelas, n, total);
      const soma = out.reduce((a, p) => a + p.valorCentavos, 0);
      expect(soma).toBe(total);
    }
  });
});

// ===== Total manual (override) + parcelas =====
// Replica a regra do serviço (montarDados): quando há total manual > 0,
// ele passa a valer como total efetivo e as parcelas somam esse valor.
describe('Total manual (override) e parcelas', () => {
  const totalEfetivo = (
    totalCalculadoCentavos: number,
    totalManualReais?: number | null,
  ): number => {
    const temManual =
      totalManualReais !== undefined &&
      totalManualReais !== null &&
      Number(totalManualReais) > 0;
    const totalManualCentavos = temManual
      ? reaisParaCentavos(totalManualReais as number)
      : null;
    return totalManualCentavos ?? totalCalculadoCentavos;
  };

  it('usa o total calculado quando não há total manual', () => {
    const itens: ItemCalc[] = [{ quantidade: 1, valorItemCentavos: 10000 }];
    const t = calcTotais(itens, 0);
    expect(totalEfetivo(t.totalCentavos, null)).toBe(10000);
    expect(totalEfetivo(t.totalCentavos, 0)).toBe(10000); // 0 não conta como manual
  });

  it('total manual > 0 sobrepõe o total calculado', () => {
    const itens: ItemCalc[] = [{ quantidade: 1, valorItemCentavos: 10000 }];
    const t = calcTotais(itens, 0);
    expect(totalEfetivo(t.totalCentavos, 250)).toBe(25000);
  });

  it('as parcelas passam a somar o total manual', () => {
    const efetivo = totalEfetivo(10000, 250); // 25000 centavos
    const out = normalizarParcelas([], 3, efetivo);
    const soma = out.reduce((a, p) => a + p.valorCentavos, 0);
    expect(soma).toBe(25000);
    expect(out.map((p) => p.valorCentavos)).toEqual([8333, 8333, 8334]);
  });
});
