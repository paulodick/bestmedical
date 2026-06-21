import { Injectable } from '@nestjs/common';
import PdfPrinter from 'pdfmake';
import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces';
import { LOGO_BASE64 } from './logo.base64';

// Fontes padrão do pdfmake (Roboto via fontes embutidas do Helvetica core).
// Usamos as fontes "core" do PDF (Helvetica) para não depender de arquivos .ttf.
const fonts = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
};

const TEAL = '#0d7d8a';
const SLATE900 = '#0f172a';
const SLATE700 = '#334155';
const SLATE600 = '#475569';
const SLATE400 = '#94a3b8';
const SLATE300 = '#cbd5e1';

// ===== Formatação (espelha o front) =====
const brl = (v: number) =>
  (v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });

const dataBR = (iso: string) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
};

@Injectable()
export class PdfService {
  private printer = new PdfPrinter(fonts);

  // Recebe o orçamento já serializado (mesmo formato do front)
  gerar(o: any): Promise<Buffer> {
    const marcaExibida =
      o.marca === 'Outras' ? o.marcaOutras || 'Outras' : o.marca;
    const itens = (o.itens || []).filter(
      (it: any) => it.item || it.codigo || it.valorItem,
    );
    const temDesconto = (o.descontoPercent || 0) > 0;
    const temParcelas = (o.numParcelas || 1) > 1 && (o.parcelas || []).length > 1;

    const content: Content[] = [];

    // ===== Cabeçalho =====
    content.push({
      columns: [
        {
          width: 'auto',
          stack: [
            { image: LOGO_BASE64, width: 42 },
          ],
          margin: [0, 0, 8, 0],
        },
        {
          width: '*',
          stack: [
            { text: 'Best Medical', bold: true, fontSize: 15, color: SLATE900 },
            {
              text: 'Manutenção de Equipamentos Médicos',
              fontSize: 9,
              color: SLATE600,
            },
          ],
          margin: [0, 4, 0, 0],
        },
        {
          width: 'auto',
          alignment: 'right',
          stack: [
            { text: 'ORÇAMENTO', bold: true, fontSize: 14, color: SLATE900 },
            {
              text: [
                { text: 'Nº ', color: SLATE600 },
                { text: o.numero || '', bold: true, color: SLATE700 },
              ],
              fontSize: 10,
              margin: [0, 3, 0, 0],
            },
            {
              text: [
                { text: 'Data: ', color: SLATE600 },
                { text: dataBR(o.data), bold: true, color: SLATE700 },
              ],
              fontSize: 10,
            },
          ],
        },
      ],
    });
    // linha divisória
    content.push({
      canvas: [
        { type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1.4, lineColor: SLATE900 },
      ],
      margin: [0, 6, 0, 10],
    });

    // ===== Cliente + Solicitante =====
    const enderecoLinhas: string[] = [];
    if (o.endereco || o.cidade) {
      // Endereço, número, complemento e bairro na primeira linha.
      const ruaNumero = [o.endereco, o.enderecoNumero]
        .filter(Boolean)
        .join(', ');
      const l1 = [ruaNumero, o.complemento, o.bairro]
        .filter(Boolean)
        .join(' - ');
      const l2 =
        [o.cidade, o.estado].filter(Boolean).join(' - ') +
        (o.cep ? ` — CEP ${o.cep}` : '');
      if (l1) enderecoLinhas.push(l1);
      if (l2.trim()) enderecoLinhas.push(l2);
      if (o.pais) enderecoLinhas.push(o.pais);
    }
    content.push({
      columns: [
        {
          width: '*',
          stack: [
            { text: 'CLIENTE', fontSize: 8, bold: true, color: SLATE400, characterSpacing: 0.5 },
            { text: o.empresa || '—', bold: true, color: SLATE900, margin: [0, 2, 0, 0], lineHeight: 1.2 },
            ...(o.cnpj ? [{ text: `CNPJ: ${o.cnpj}`, color: SLATE600, fontSize: 10, lineHeight: 1.2 }] : []),
            ...enderecoLinhas.map((l) => ({ text: l, color: SLATE600, fontSize: 10, lineHeight: 1.2 })),
          ],
        },
        {
          width: '*',
          stack: [
            { text: 'SOLICITANTE', fontSize: 8, bold: true, color: SLATE400, characterSpacing: 0.5 },
            { text: o.solicitante || '—', bold: true, color: SLATE900, margin: [0, 2, 0, 0], lineHeight: 1.2 },
            ...(o.setor ? [{ text: o.setor, color: SLATE600, fontSize: 10, lineHeight: 1.2 }] : []),
            ...(o.telefone ? [{ text: o.telefone, color: SLATE600, fontSize: 10, lineHeight: 1.2 }] : []),
            ...(o.email ? [{ text: o.email, color: SLATE600, fontSize: 10, lineHeight: 1.2 }] : []),
          ],
        },
      ],
      columnGap: 24,
      margin: [0, 0, 0, 12],
    });

    // ===== Dados do equipamento =====
    // Cada campo é exibido em um "cartão" próprio (rótulo em negrito acima e o
    // valor preenchido abaixo), dispostos em duas colunas, para facilitar a
    // leitura em vez de tudo concatenado numa única linha de texto.
    const tecnicos: Content[] = [];
    const camposTec: { rotulo: string; valor: string }[] = [];
    if (o.modalidade) camposTec.push({ rotulo: 'MODALIDADE', valor: o.modalidade });
    if (marcaExibida) camposTec.push({ rotulo: 'MARCA', valor: marcaExibida });
    if (o.modelo) camposTec.push({ rotulo: 'MODELO', valor: o.modelo });
    if (o.numeroSerie) camposTec.push({ rotulo: 'Nº DE SÉRIE', valor: o.numeroSerie });

    // Monta um cartão (célula) para um campo do equipamento.
    const cartaoCampo = (campo: { rotulo: string; valor: string }) => ({
      stack: [
        { text: campo.rotulo, fontSize: 7, bold: true, color: SLATE400, characterSpacing: 0.5, margin: [0, 0, 0, 1] },
        { text: campo.valor, fontSize: 10, bold: true, color: SLATE900 },
      ],
      fillColor: '#f8fafc',
      margin: [8, 4, 8, 4],
    });

    // Célula vazia (mantém o grid alinhado quando o nº de campos é ímpar).
    const cartaoVazio = () => ({ text: '', border: [false, false, false, false] });

    if (camposTec.length || o.descricaoVisita) {
      tecnicos.push({
        text: 'DADOS DO EQUIPAMENTO',
        fontSize: 8,
        bold: true,
        color: SLATE400,
        characterSpacing: 0.5,
        margin: [0, 0, 0, 4],
      });

      if (camposTec.length) {
        // Agrupa os campos em linhas de 2 colunas.
        const linhasCartoes: any[] = [];
        for (let i = 0; i < camposTec.length; i += 2) {
          const esquerda = cartaoCampo(camposTec[i]);
          const direita = camposTec[i + 1] ? cartaoCampo(camposTec[i + 1]) : cartaoVazio();
          linhasCartoes.push([esquerda, direita]);
        }
        tecnicos.push({
          table: {
            widths: ['*', '*'],
            body: linhasCartoes,
          },
          // Espaçamento entre os cartões (linhas e colunas).
          layout: {
            hLineWidth: () => 0,
            vLineWidth: () => 0,
            paddingLeft: (i: number) => (i === 0 ? 0 : 3),
            paddingRight: (i: number, node: any) => (i === node.table.widths.length - 1 ? 0 : 3),
            paddingTop: () => 2,
            paddingBottom: () => 2,
          },
          margin: [0, 0, 0, 0],
        });
      }

      if (o.descricaoVisita) {
        tecnicos.push({
          table: {
            widths: ['*'],
            body: [
              [
                {
                  stack: [
                    { text: 'DESCRIÇÃO DA VISITA TÉCNICA', fontSize: 7, bold: true, color: SLATE400, characterSpacing: 0.5, margin: [0, 0, 0, 2] },
                    { text: o.descricaoVisita, fontSize: 10, color: SLATE700 },
                  ],
                  fillColor: '#f8fafc',
                  margin: [8, 4, 8, 4],
                },
              ],
            ],
          },
          layout: 'noBorders',
          margin: [0, 5, 0, 0],
        });
      }

      tecnicos.push({ text: '', margin: [0, 0, 0, 8] });
    }
    content.push(...tecnicos);

    // ===== Tabela de itens =====
    const itemHeader = [
      { text: 'Código', bold: true, color: SLATE600, fontSize: 9 },
      { text: 'Item', bold: true, color: SLATE600, fontSize: 9 },
      { text: 'Qtd.', bold: true, color: SLATE600, fontSize: 9, alignment: 'center' },
      { text: 'Valor unit.', bold: true, color: SLATE600, fontSize: 9, alignment: 'right' },
      { text: 'Total', bold: true, color: SLATE600, fontSize: 9, alignment: 'right' },
    ];
    const itemRows =
      itens.length === 0
        ? [[{ text: 'Nenhum item adicionado.', color: SLATE400, colSpan: 5, alignment: 'center', margin: [0, 6, 0, 6] }, {}, {}, {}, {}]]
        : itens.map((it: any) => [
            { text: it.codigo || '—', color: SLATE600, fontSize: 10 },
            { text: it.item || '—', color: SLATE700, fontSize: 10 },
            { text: String(it.quantidade), color: SLATE700, fontSize: 10, alignment: 'center' },
            { text: brl(it.valorItem), color: SLATE700, fontSize: 10, alignment: 'right' },
            { text: brl((it.quantidade || 0) * (it.valorItem || 0)), color: SLATE900, bold: true, fontSize: 10, alignment: 'right' },
          ]);

    content.push({
      table: {
        headerRows: 1,
        widths: ['auto', '*', 'auto', 'auto', 'auto'],
        body: [itemHeader, ...itemRows],
      },
      layout: {
        hLineWidth: (i: number) => (i === 1 ? 0.8 : 0.4),
        vLineWidth: () => 0,
        hLineColor: (i: number) => (i === 1 ? SLATE300 : '#e2e8f0'),
        paddingTop: () => 5,
        paddingBottom: () => 5,
        paddingLeft: () => 2,
        paddingRight: () => 2,
      },
      margin: [0, 0, 0, 10],
    });

    // ===== Resumo (desconto só quando houver) =====
    const resumoStack: Content[] = [];
    if (temDesconto) {
      resumoStack.push({
        columns: [
          { text: 'Subtotal', color: SLATE600, fontSize: 10 },
          { text: brl(o.subtotal ?? o.total), color: SLATE600, fontSize: 10, alignment: 'right' },
        ],
        margin: [0, 0, 0, 2],
      });
      resumoStack.push({
        columns: [
          { text: `Desconto (${o.descontoPercent}%)`, color: SLATE600, fontSize: 10 },
          { text: `- ${brl(o.desconto ?? 0)}`, color: SLATE600, fontSize: 10, alignment: 'right' },
        ],
        margin: [0, 0, 0, 4],
      });
    }
    resumoStack.push({
      table: {
        widths: ['*'],
        body: [
          [
            {
              stack: [
                { text: 'TOTAL DO ORÇAMENTO', color: '#ffffff', fontSize: 8, characterSpacing: 0.5, alignment: 'right' },
                { text: brl(o.total), color: '#ffffff', bold: true, fontSize: 18, alignment: 'right', margin: [0, 2, 0, 0] },
              ],
              fillColor: TEAL,
              margin: [10, 8, 10, 8],
              border: [false, false, false, false],
            },
          ],
        ],
      },
      layout: 'noBorders',
    });

    content.push({
      columns: [
        { width: '*', text: '' },
        { width: 200, stack: resumoStack },
      ],
      margin: [0, 0, 0, 12],
    });

    // ===== Condições de pagamento (só quando parcelado) =====
    if (temParcelas) {
      const parcHeader = [
        { text: 'Parcela', bold: true, color: SLATE600, fontSize: 9 },
        { text: 'Vencimento', bold: true, color: SLATE600, fontSize: 9 },
        { text: 'Valor', bold: true, color: SLATE600, fontSize: 9, alignment: 'right' },
      ];
      const parcRows = (o.parcelas || []).map((p: any) => [
        { text: String(p.numero), color: SLATE700, fontSize: 10 },
        { text: p.data ? dataBR(p.data) : '—', color: SLATE700, fontSize: 10 },
        { text: brl(p.valor), color: SLATE700, fontSize: 10, alignment: 'right' },
      ]);
      content.push({
        text: `CONDIÇÕES DE PAGAMENTO — ${o.numParcelas}x`,
        fontSize: 9,
        bold: true,
        color: SLATE400,
        characterSpacing: 0.5,
        margin: [0, 0, 0, 4],
      });
      content.push({
        table: {
          headerRows: 1,
          widths: ['auto', '*', 'auto'],
          body: [parcHeader, ...parcRows],
        },
        layout: {
          hLineWidth: (i: number) => (i === 1 ? 0.8 : 0.4),
          vLineWidth: () => 0,
          hLineColor: () => '#e2e8f0',
          paddingTop: () => 4,
          paddingBottom: () => 4,
          paddingLeft: () => 2,
          paddingRight: () => 2,
        },
        margin: [0, 0, 0, 12],
        // limita a largura da tabela
        ...( { _maxWidth: 320 } as any),
      });
    }

    // ===== Observações / texto final =====
    if (o.observacoes || o.textoFinal) {
      const obs: Content[] = [];
      if (o.observacoes)
        obs.push({
          text: [
            { text: 'Observações: ', bold: true, color: SLATE700 },
            { text: o.observacoes, color: SLATE600 },
          ],
          fontSize: 10,
          margin: [0, 0, 0, 6],
        });
      if (o.textoFinal)
        obs.push({ text: o.textoFinal, color: SLATE600, fontSize: 10 });
      content.push({
        stack: obs,
        margin: [0, 6, 0, 0],
      });
    }

    // ===== Rodapé / assinatura =====
    content.push({
      stack: [
        { text: 'When uptime matters.', italics: true, bold: true, color: TEAL, fontSize: 11, alignment: 'center' },
        { text: 'Best Medical • Documento gerado pelo sistema interno de orçamentos', color: SLATE400, fontSize: 9, alignment: 'center', margin: [0, 2, 0, 0] },
      ],
      margin: [0, 24, 0, 0],
    });

    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 40],
      defaultStyle: { font: 'Helvetica', fontSize: 11, color: SLATE700 },
      content,
      // marca d'água discreta com o logo
      background: () => ({
        image: LOGO_BASE64,
        width: 300,
        opacity: 0.04,
        absolutePosition: { x: 150, y: 320 },
      }),
    };

    return new Promise((resolve, reject) => {
      try {
        const doc = this.printer.createPdfKitDocument(docDefinition);
        const chunks: Buffer[] = [];
        doc.on('data', (c: Buffer) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        doc.end();
      } catch (e) {
        reject(e);
      }
    });
  }
}
