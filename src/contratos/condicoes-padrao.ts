// ===== Condições padrão por tipo de contrato (fonte de verdade no servidor) =====
// O mesmo conteúdo existe no frontend (src/types.ts → CONDICOES_PADRAO).
// Apenas "Mão de Obra - Especial" tem texto real; os demais são placeholders.

export const TIPOS_CONTRATO = [
  'Suporte Remoto',
  'Mão de Obra - Regular',
  'Mão de Obra - Especial',
] as const;

export type TipoContrato = (typeof TIPOS_CONTRATO)[number];

// Texto padrão da modalidade "Mão de Obra - Especial" (seções e bullets).
const MAO_DE_OBRA_ESPECIAL = `PONTOS DE ATENDIMENTO E PRAZOS
• Abertura de chamado: das 7h às 23h.
• Suporte telefônico: em até 4h dentro da janela de atendimento. Se o prazo ultrapassar as 23h, o saldo de horas é retomado no dia seguinte a partir das 7h.
• Atendimento presencial: em até 24h, de segunda a segunda, salvo justificativa nossa em prol da efetividade (ex.: necessidade de peça ou envio de ferramental).
• Manutenções preventivas e corretivas: agendáveis em horário estendido (7h às 23h, de segunda a segunda) para minimizar a parada de máquina.

PEÇAS E REPAROS
• Dispomos de laboratório de reparo e estoque de peças próprios. O cliente é livre para realizar reparos ou comprar peças com outras empresas.
• Reparo ou Fornecimento de Peças possuem condições diferenciadas e fluxo prioritário para clientes em contrato.

DESPESAS
• Inclusas no contrato: deslocamento terrestre, alimentação e hospedagem.
• Por conta da contratante: envio de ferramental e despesas aéreas — encaminhadas em demonstrativo após o atendimento, com pagamento junto ao contrato do mês seguinte.`;

// Mapa tipo → texto padrão. Os tipos sem texto real usam um placeholder curto.
export const CONDICOES_PADRAO: Record<string, string> = {
  'Suporte Remoto': '(condições a definir)',
  'Mão de Obra - Regular': '(condições a definir)',
  'Mão de Obra - Especial': MAO_DE_OBRA_ESPECIAL,
};
