// ===== Gerador do corpo do contrato a partir da proposta =====
// Fonte de verdade do layout: /home/user/workspace/template_ref/template_contrato.js
// (DOCX) e template_contrato.py (PDF). Aqui o conteúdo das cláusulas é gerado
// como TEXTO (uma cláusula/parágrafo por linha) para que:
//   1) o usuário possa editá-lo livremente (igual às "Condições do Contrato" da
//      proposta);
//   2) o diff linha a linha contra o padrão alimente o bloco de customizações
//      replicado nas Observações Internas da proposta;
//   3) o PDF seja renderizado a partir desse texto (títulos em CAIXA ALTA viram
//      cabeçalhos de cláusula, linhas iniciadas por "• " viram bullets).
//
// Regras do template preservadas:
//   - Pluralização condicional (1 vs N equipamentos) via w(singular, plural).
//   - Cláusula de Quench apenas quando há equipamento de ressonância magnética.
//   - CONTRATANTE = cliente da proposta; CONTRATADA = Best Medical Ltda (fixo).
//   - Foro = comarca da sede da CONTRATANTE (cidade/UF do cliente).

// Dados fixos da CONTRATADA (Best Medical Ltda).
export const CONTRATADA = {
  razaoSocial: 'BEST MEDICAL LTDA',
  cnpj: '65.214.021/0001-55',
  endereco: 'Rua Teodoro Sampaio, nº 776, Pinheiros, São Paulo/SP, CEP 05406-000',
  representante: 'Paulo Eduardo Adoglio Dick',
  cpfRepresentante: '392.987.218-89',
};

const brl = (v: number) =>
  (v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });

// True quando algum equipamento é de ressonância magnética (case-insensitive).
export function temRessonancia(equipamentos: any[]): boolean {
  return (equipamentos || []).some((e) =>
    /ressonância|ressonancia/i.test(String(e?.modalidade || '')),
  );
}

// Deriva o número do contrato a partir do número da proposta (PC-... -> CT-...).
export function numeroContratoDeProposta(numeroProposta: string): string {
  const n = (numeroProposta || '').trim();
  if (!n) return 'CT-SEM-NUMERO';
  if (/^PC-/i.test(n)) return n.replace(/^PC-/i, 'CT-');
  return `CT-${n}`;
}

const marcaDe = (e: any): string =>
  e?.marca === 'Outras' ? e?.marcaOutras || 'Outras' : e?.marca || '';

// Descrição de um equipamento em uma linha (bullet da cláusula 1).
const linhaEquip = (e: any): string => {
  const partes = [e?.modalidade, marcaDe(e), e?.modelo].filter(Boolean).join(' ');
  const serie = e?.numeroSerie ? ` — Nº de Série ${e.numeroSerie}` : '';
  return `• ${partes || 'Equipamento'}${serie}`;
};

// Comarca/foro da CONTRATANTE (cidade/UF do cliente).
const comarca = (p: any): string => {
  const cidade = (p?.cidade || '').trim();
  const uf = (p?.estado || '').trim();
  if (cidade && uf) return `${cidade}/${uf}`;
  if (cidade) return cidade;
  return '____________';
};

// Endereço completo do cliente em uma linha (para a qualificação das PARTES).
const enderecoContratante = (p: any): string => {
  const ruaNumero = [p?.endereco, p?.enderecoNumero].filter(Boolean).join(', nº ');
  const linha = [ruaNumero, p?.complemento, p?.bairro, comarca(p)]
    .filter(Boolean)
    .join(', ');
  const cep = p?.cep ? `, CEP ${p.cep}` : '';
  return `${linha}${cep}` || '____________';
};

// ===== Gera o corpo do contrato (texto editável, uma linha por parágrafo) =====
export function gerarCorpoContrato(p: any): string {
  const equipamentos = (p?.equipamentos || []).filter(
    (e: any) =>
      e?.modalidade || e?.marca || e?.modelo || e?.numeroSerie || e?.valorContrato,
  );
  const plural = equipamentos.length > 1;
  const w = (s: string, pl: string) => (plural ? pl : s);
  const numero = p?.numero || '';
  const temDesconto = (p?.descontoPercent || 0) > 0;

  const L: string[] = [];

  // ----- PARTES -----
  L.push('PARTES');
  L.push(
    `CONTRATANTE: ${p?.empresa || '____________'}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${p?.cnpj || '____________'}, com sede na ${enderecoContratante(p)}, neste ato representada por seu(s) representante(s) legal(is), doravante denominada simplesmente CONTRATANTE.`,
  );
  L.push(
    `CONTRATADA: ${CONTRATADA.razaoSocial}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${CONTRATADA.cnpj}, com sede na ${CONTRATADA.endereco}, neste ato representada por seu representante legal, Sr. ${CONTRATADA.representante}, CPF nº ${CONTRATADA.cpfRepresentante}, doravante denominada simplesmente CONTRATADA.`,
  );
  L.push(
    'As partes acima qualificadas têm entre si justo e contratado o presente Contrato de Prestação de Serviços, que se regerá pelas cláusulas e condições a seguir.',
  );

  // ----- CLÁUSULA 1 — OBJETO -----
  L.push('CLÁUSULA 1ª – OBJETO');
  L.push(
    `1.1. O presente contrato tem por objeto a prestação, pela CONTRATADA, de serviços técnicos de manutenção corretiva e preventiva, exclusivamente em regime de mão de obra, ${w('no equipamento abaixo identificado', 'nos equipamentos abaixo identificados')}, de propriedade da CONTRATANTE:`,
  );
  if (equipamentos.length === 0) {
    L.push('• (nenhum equipamento informado)');
  } else {
    equipamentos.forEach((e: any) => L.push(linhaEquip(e)));
  }
  L.push(
    '1.2. Os serviços contratados compreendem exclusivamente a mão de obra técnica especializada, na modalidade Mão de Obra – Especial. O fornecimento de peças, materiais de consumo, insumos, gases criogênicos, bem como o aluguel e o envio de ferramentas, instrumentos ou ferramental específico — quando aplicáveis — não estão incluídos no escopo deste contrato e correrão por conta exclusiva da CONTRATANTE.',
  );

  // ----- CLÁUSULA 2 — ESCOPO, PRAZOS E HORÁRIOS -----
  L.push('CLÁUSULA 2ª – ESCOPO DOS SERVIÇOS, PRAZOS E HORÁRIOS');
  L.push(
    `2.1. Pontos de atendimento e prazos (conforme Proposta Comercial ${numero}):`,
  );
  L.push('• Abertura de chamado: das 7h às 23h.');
  L.push(
    '• Suporte telefônico (remoto): em até 3h dentro da janela de atendimento. Se o prazo ultrapassar as 23h, o saldo de horas é retomado no dia seguinte a partir das 7h.',
  );
  L.push(
    '• Atendimento presencial: em até 24h, de segunda a segunda, salvo justificativa da CONTRATADA em prol da efetividade (ex.: necessidade de peça ou envio de ferramental).',
  );
  L.push(
    `• ${w('Manutenção preventiva e corretiva', 'Manutenções preventivas e corretivas')}: ${w('agendável', 'agendáveis')} em horário estendido (7h às 23h, de segunda a segunda) para minimizar a parada ${w('da máquina', 'das máquinas')}.`,
  );
  L.push('2.2. Peças e reparos:');
  L.push(
    '• A CONTRATADA dispõe de laboratório de reparo e estoque de peças próprios. A CONTRATANTE é livre para realizar reparos ou comprar peças com outras empresas.',
  );
  L.push(
    '• O reparo ou fornecimento de peças possuem condições diferenciadas e fluxo prioritário para clientes em contrato.',
  );
  L.push('2.3. Despesas de atendimento:');
  L.push(
    '• Inclusas no contrato: deslocamento terrestre, alimentação e hospedagem.',
  );
  L.push(
    '• Por conta da CONTRATANTE: despesas aéreas e demais custos de deslocamento não incluídos — encaminhadas em demonstrativo após o atendimento, com pagamento junto à parcela do mês seguinte.',
  );
  L.push(
    '2.4. Peças, insumos, reparos e ferramental: o fornecimento e/ou aluguel de peças, materiais de consumo, insumos, gases criogênicos, ferramental, instrumentos ou equipamentos auxiliares, bem como serviços de reparo em laboratório, não estão incluídos no valor mensal deste contrato. Sempre que necessários, serão objeto de orçamento prévio específico, a ser apresentado pela CONTRATADA e somente executado, fornecido ou cobrado mediante aprovação expressa da CONTRATANTE.',
  );

  // ----- CLÁUSULA 3 — VALOR E PAGAMENTO -----
  L.push('CLÁUSULA 3ª – VALOR E CONDIÇÕES DE PAGAMENTO');
  const valor = brl(p?.total || 0);
  const descontoTexto = temDesconto
    ? `, já considerado o desconto de ${p.descontoPercent}% aplicado conforme Proposta Comercial ${numero}`
    : `, conforme Proposta Comercial ${numero}`;
  L.push(
    `3.1. Pelos serviços ora contratados, a CONTRATANTE pagará à CONTRATADA o valor mensal de ${valor}${descontoTexto}.`,
  );
  L.push(
    '3.2. O pagamento será efetuado todo dia 1º (primeiro) de cada mês, mediante a emissão e apresentação da respectiva nota fiscal pela CONTRATADA.',
  );
  L.push(
    '3.3. As despesas de atendimento por conta da CONTRATANTE (cláusula 2.3) serão apresentadas em demonstrativo após cada atendimento, com os respectivos comprovantes, e pagas pela CONTRATANTE junto à parcela mensal subsequente.',
  );
  L.push(
    '3.4. Os valores referentes a peças, insumos, reparos e ferramental (cláusula 2.4) serão cobrados separadamente, conforme orçamento prévio aprovado pela CONTRATANTE, nas condições de pagamento ali pactuadas.',
  );

  // ----- CLÁUSULA 4 — VIGÊNCIA, RENOVAÇÃO E REAJUSTE -----
  L.push('CLÁUSULA 4ª – VIGÊNCIA, RENOVAÇÃO E REAJUSTE');
  L.push(
    '4.1. O presente contrato vigorará pelo prazo de 12 (doze) meses, a contar da data de sua assinatura.',
  );
  L.push(
    '4.2. O contrato será renovado automaticamente por iguais e sucessivos períodos de 12 (doze) meses, caso nenhuma das partes manifeste, por escrito, intenção em contrário com antecedência mínima de 30 (trinta) dias do término do período em vigor.',
  );
  L.push(
    '4.3. O valor mensal poderá ser reajustado, a cada renovação, pela variação acumulada do IGP-M (Índice Geral de Preços – Mercado), divulgado pela Fundação Getulio Vargas (FGV), nos 12 meses anteriores à data do reajuste. Na hipótese de extinção do IGP-M, poderá ser adotado o índice oficial que vier a substituí-lo ou, na sua ausência, o IPCA/IBGE.',
  );

  // ----- CLÁUSULA 5 — RESCISÃO -----
  L.push('CLÁUSULA 5ª – RESCISÃO');
  L.push(
    '5.1. Não há multa por cancelamento. Qualquer das partes poderá rescindir o contrato mediante aviso prévio, por escrito, de 30 (trinta) dias.',
  );
  L.push(
    '5.2. Na hipótese de rescisão, a CONTRATANTE permanece obrigada ao pagamento integral do mês imediatamente subsequente ao aviso prévio, a fim de permitir à CONTRATADA tempo hábil para se reorganizar financeira e operacionalmente.',
  );

  // ----- CLÁUSULA 6 — OBRIGAÇÕES DA CONTRATADA -----
  L.push('CLÁUSULA 6ª – OBRIGAÇÕES DA CONTRATADA');
  L.push(
    `• Prestar os serviços com diligência, qualidade técnica e dentro dos prazos previstos neste contrato e na Proposta ${numero};`,
  );
  L.push(
    `• Manter equipe técnica qualificada para o atendimento ${w('ao equipamento descrito', 'aos equipamentos descritos')} na Cláusula 1;`,
  );
  L.push(
    '• Disponibilizar laboratório de reparo e estoque de peças, com condições diferenciadas e fluxo prioritário para a CONTRATANTE;',
  );
  L.push('• Apresentar demonstrativo das despesas reembolsáveis após cada atendimento;');
  L.push(
    '• Emitir nota fiscal mensal correspondente aos serviços prestados, no dia 1º de cada mês.',
  );

  // ----- CLÁUSULA 7 — OBRIGAÇÕES DA CONTRATANTE -----
  L.push('CLÁUSULA 7ª – OBRIGAÇÕES DA CONTRATANTE');
  L.push('• Efetuar os pagamentos mensais nos prazos acordados;');
  L.push(
    '• Custear as despesas de atendimento não inclusas no contrato, conforme demonstrativo apresentado após cada atendimento;',
  );
  L.push(
    '• Analisar e aprovar previamente os orçamentos relativos a peças, insumos, reparos e ferramental, quando aplicáveis;',
  );
  L.push(
    `• Disponibilizar acesso ${w('ao equipamento', 'aos equipamentos')} e às instalações necessárias para a execução dos serviços.`,
  );

  // ----- CLÁUSULA CONDICIONAL — QUENCH (só com ressonância) -----
  let clNum = 8;
  if (temRessonancia(equipamentos)) {
    L.push(`CLÁUSULA ${clNum}ª – QUENCH E LUCROS CESSANTES`);
    L.push(
      `${clNum}.1. As partes reconhecem que o equipamento de ressonância magnética objeto deste contrato é dotado de magneto supercondutor refrigerado por hélio líquido a temperaturas criogênicas. O fenômeno conhecido como quench consiste na perda abrupta da supercondutividade da bobina, com rápida vaporização e liberação do hélio líquido para fora do equipamento e consequente desmagnetização do sistema.`,
    );
    L.push(
      `${clNum}.2. O quench constitui risco inerente à operação de equipamentos de ressonância magnética e pode decorrer de múltiplos fatores, incluindo, sem limitação: falhas elétricas, oscilações da rede, falhas no sistema criogênico, acionamento manual ou automático do botão de emergência, eventos externos e falhas próprias dos componentes do magneto. Trata-se, portanto, de evento intrínseco ao funcionamento do equipamento e não imputável à CONTRATADA.`,
    );
    L.push(
      `${clNum}.3. Na hipótese de ocorrência de quench, por qualquer causa, a CONTRATADA não se responsabiliza por quaisquer despesas, custos ou prejuízos dele decorrentes, incluindo, exemplificativamente: recarga de hélio líquido, ramping, reparos, calibrações, shimming e demais serviços correlatos. Tais custos correrão integralmente por conta da CONTRATANTE.`,
    );
    L.push(
      `${clNum}.4. A CONTRATADA não se responsabiliza por lucros cessantes, perda de receita, perda de produção, danos indiretos ou consequenciais decorrentes de paradas ${w('do equipamento', 'dos equipamentos')}, ainda que tais paradas ocorram durante a vigência deste contrato e independentemente de sua causa, limitando-se sua responsabilidade à correta execução da mão de obra contratada.`,
    );
    clNum++;
  }

  // ----- DISPOSIÇÕES GERAIS -----
  L.push(`CLÁUSULA ${clNum}ª – DISPOSIÇÕES GERAIS`);
  L.push(
    `${clNum}.1. Quaisquer alterações a este contrato somente terão validade se formalizadas por termo aditivo escrito, assinado por ambas as partes.`,
  );
  L.push(
    `${clNum}.2. A tolerância de qualquer das partes quanto ao descumprimento de obrigações pela outra não constituirá renúncia ao direito de exigi-lo posteriormente.`,
  );
  L.push(
    `${clNum}.3. As partes elegem o foro da comarca de ${comarca(p)} para dirimir eventuais controvérsias decorrentes deste contrato, com renúncia a qualquer outro, por mais privilegiado que seja.`,
  );
  L.push(
    'E por estarem assim justas e contratadas, as partes assinam o presente instrumento em 2 (duas) vias de igual teor e forma.',
  );

  return L.join('\n');
}
