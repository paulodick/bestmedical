import { Injectable } from '@nestjs/common';
import PdfPrinter from 'pdfmake';
import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces';
import { LOGO_BASE64 } from '../../orcamentos/pdf/logo.base64';

// Fontes "core" do PDF (Helvetica) — não dependem de arquivos .ttf.
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

// Soma 30 dias a uma data ISO yyyy-mm-dd (validade da proposta)
const addDias = (iso: string, dias: number): string => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '';
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + dias);
  return dt.toISOString().slice(0, 10);
};

@Injectable()
export class PropostaPdfService {
  private printer = new PdfPrinter(fonts);

  // Recebe a proposta já serializada (mesmo formato do front)
  gerar(p: any): Promise<Buffer> {
    const equipamentos = (p.equipamentos || []).filter(
      (e: any) =>
        e.modalidade || e.marca || e.modelo || e.numeroSerie || e.valorContrato,
    );
    const temDesconto = (p.descontoPercent || 0) > 0;
    const marcaDe = (e: any) =>
      e.marca === 'Outras' ? e.marcaOutras || 'Outras' : e.marca;

    const content: Content[] = [];

    // ===== Cabeçalho =====
    content.push({
      columns: [
        {
          width: 'auto',
          stack: [{ image: LOGO_BASE64, width: 42 }],
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
            {
              text: 'PROPOSTA DE CONTRATO',
              bold: true,
              fontSize: 13,
              color: SLATE900,
            },
            ...(p.tipoContrato
              ? [
                  {
                    text: p.tipoContrato,
                    fontSize: 9,
                    color: TEAL,
                    bold: true,
                    margin: [0, 1, 0, 0] as [number, number, number, number],
                  },
                ]
              : []),
            {
              text: [
                { text: 'Nº ', color: SLATE600 },
                { text: p.numero || '', bold: true, color: SLATE700 },
              ],
              fontSize: 10,
              margin: [0, 3, 0, 0],
            },
            {
              text: [
                { text: 'Data: ', color: SLATE600 },
                { text: dataBR(p.data), bold: true, color: SLATE700 },
              ],
              fontSize: 10,
            },
            {
              text: [
                { text: 'Validade: ', color: SLATE600 },
                {
                  text: `${dataBR(addDias(p.data, 30))} (30 dias)`,
                  bold: true,
                  color: SLATE700,
                },
              ],
              fontSize: 10,
            },
          ],
        },
      ],
    });
    content.push({
      canvas: [
        {
          type: 'line',
          x1: 0,
          y1: 5,
          x2: 515,
          y2: 5,
          lineWidth: 1.4,
          lineColor: SLATE900,
        },
      ],
      margin: [0, 6, 0, 10],
    });

    // ===== Cliente + Solicitante =====
    const enderecoLinhas: string[] = [];
    if (p.endereco || p.cidade) {
      const ruaNumero = [p.endereco, p.enderecoNumero].filter(Boolean).join(', ');
      const l1 = [ruaNumero, p.complemento, p.bairro].filter(Boolean).join(' - ');
      const l2 =
        [p.cidade, p.estado].filter(Boolean).join(' - ') +
        (p.cep ? ` — CEP ${p.cep}` : '');
      if (l1) enderecoLinhas.push(l1);
      if (l2.trim()) enderecoLinhas.push(l2);
      if (p.pais) enderecoLinhas.push(p.pais);
    }
    content.push({
      columns: [
        {
          width: '*',
          stack: [
            { text: 'CLIENTE', fontSize: 8, bold: true, color: SLATE400, characterSpacing: 0.5 },
            { text: p.empresa || '—', bold: true, color: SLATE900, margin: [0, 2, 0, 0], lineHeight: 1.2 },
            ...(p.cnpj ? [{ text: `CNPJ: ${p.cnpj}`, color: SLATE600, fontSize: 10, lineHeight: 1.2 }] : []),
            ...enderecoLinhas.map((l) => ({ text: l, color: SLATE600, fontSize: 10, lineHeight: 1.2 })),
          ],
        },
        {
          width: '*',
          stack: [
            { text: 'SOLICITANTE', fontSize: 8, bold: true, color: SLATE400, characterSpacing: 0.5 },
            { text: p.solicitante || '—', bold: true, color: SLATE900, margin: [0, 2, 0, 0], lineHeight: 1.2 },
            ...(p.setor ? [{ text: p.setor, color: SLATE600, fontSize: 10, lineHeight: 1.2 }] : []),
            ...(p.telefone ? [{ text: p.telefone, color: SLATE600, fontSize: 10, lineHeight: 1.2 }] : []),
            ...(p.email ? [{ text: p.email, color: SLATE600, fontSize: 10, lineHeight: 1.2 }] : []),
          ],
        },
      ],
      columnGap: 24,
      margin: [0, 0, 0, 12],
    });

    // ===== Equipamentos cobertos =====
    const equipHeader = [
      { text: 'Modalidade', bold: true, color: SLATE600, fontSize: 9 },
      { text: 'Marca', bold: true, color: SLATE600, fontSize: 9 },
      { text: 'Modelo', bold: true, color: SLATE600, fontSize: 9 },
      { text: 'Nº de Série', bold: true, color: SLATE600, fontSize: 9 },
    ];
    const equipRows =
      equipamentos.length === 0
        ? [[{ text: 'Nenhum equipamento informado.', color: SLATE400, colSpan: 4, alignment: 'center', margin: [0, 6, 0, 6] }, {}, {}, {}]]
        : equipamentos.map((e: any) => [
            { text: e.modalidade || '—', color: SLATE700, fontSize: 10 },
            { text: marcaDe(e) || '—', color: SLATE700, fontSize: 10 },
            { text: e.modelo || '—', color: SLATE700, fontSize: 10 },
            { text: e.numeroSerie || '—', color: SLATE700, fontSize: 10 },
          ]);

    content.push({
      text: 'EQUIPAMENTOS COBERTOS',
      fontSize: 8,
      bold: true,
      color: SLATE400,
      characterSpacing: 0.5,
      margin: [0, 0, 0, 4],
    });
    content.push({
      table: {
        headerRows: 1,
        widths: ['*', 'auto', '*', 'auto'],
        body: [equipHeader, ...equipRows],
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
      margin: [0, 0, 0, 12],
    });

    // ===== Valores do contrato (mensal) =====
    const valorHeader = [
      { text: 'Equipamento', bold: true, color: SLATE600, fontSize: 9 },
      { text: 'Valor mensal', bold: true, color: SLATE600, fontSize: 9, alignment: 'right' },
    ];
    const valorRows =
      equipamentos.length === 0
        ? [[{ text: 'Nenhum equipamento informado.', color: SLATE400, colSpan: 2, alignment: 'center', margin: [0, 6, 0, 6] }, {}]]
        : equipamentos.map((e: any) => {
            const desc = [e.modalidade, marcaDe(e), e.modelo, e.numeroSerie]
              .filter(Boolean)
              .join(' · ');
            return [
              { text: desc || '—', color: SLATE700, fontSize: 10 },
              { text: brl(e.valorContrato), color: SLATE900, bold: true, fontSize: 10, alignment: 'right' },
            ];
          });

    content.push({
      text: 'VALORES DO CONTRATO (MENSAL)',
      fontSize: 8,
      bold: true,
      color: SLATE400,
      characterSpacing: 0.5,
      margin: [0, 0, 0, 4],
    });
    content.push({
      table: {
        headerRows: 1,
        widths: ['*', 'auto'],
        body: [valorHeader, ...valorRows],
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
          { text: brl(p.subtotal ?? p.total), color: SLATE600, fontSize: 10, alignment: 'right' },
        ],
        margin: [0, 0, 0, 2],
      });
      resumoStack.push({
        columns: [
          { text: `Desconto (${p.descontoPercent}%)`, color: SLATE600, fontSize: 10 },
          { text: `- ${brl(p.desconto ?? 0)}`, color: SLATE600, fontSize: 10, alignment: 'right' },
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
                { text: 'TOTAL MENSAL', color: '#ffffff', fontSize: 8, characterSpacing: 0.5, alignment: 'right' },
                { text: brl(p.total), color: '#ffffff', bold: true, fontSize: 18, alignment: 'right', margin: [0, 2, 0, 0] },
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

    // ===== Condições do atendimento (texto editável, por linha) =====
    if ((p.condicoesContrato || '').trim()) {
      content.push({
        text: 'CONDIÇÕES DO ATENDIMENTO',
        fontSize: 8,
        bold: true,
        color: SLATE400,
        characterSpacing: 0.5,
        margin: [0, 4, 0, 4],
      });
      // Renderiza linha a linha, respeitando seções e bullets. Linhas sem
      // bullet e em caixa alta são tratadas como títulos de seção.
      const linhas = String(p.condicoesContrato).split('\n');
      const corpo: Content[] = linhas.map((linha) => {
        const t = linha.trim();
        if (!t) return { text: ' ', margin: [0, 0, 0, 2] };
        const ehBullet = t.startsWith('•') || t.startsWith('-');
        const ehTitulo = !ehBullet && t === t.toUpperCase();
        if (ehTitulo) {
          return { text: t, bold: true, color: SLATE700, fontSize: 10, margin: [0, 4, 0, 2] };
        }
        return { text: t, color: SLATE600, fontSize: 10, margin: [0, 0, 0, 1], lineHeight: 1.2 };
      });
      content.push({ stack: corpo, margin: [0, 0, 0, 10] });
    }

    // ===== Texto final =====
    if (p.textoFinal) {
      content.push({
        text: p.textoFinal,
        color: SLATE600,
        fontSize: 10,
        margin: [0, 2, 0, 6],
      });
    }

    // Nota obrigatória
    content.push({
      text: 'Este documento é uma proposta comercial, não um contrato.',
      italics: true,
      color: SLATE400,
      fontSize: 9,
      margin: [0, 4, 0, 0],
    });

    // ===== Rodapé =====
    content.push({
      stack: [
        { text: 'When uptime matters.', italics: true, bold: true, color: TEAL, fontSize: 11, alignment: 'center' },
        { text: 'Best Medical • Documento gerado pelo sistema interno', color: SLATE400, fontSize: 9, alignment: 'center', margin: [0, 2, 0, 0] },
      ],
      margin: [0, 24, 0, 0],
    });

    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 40],
      defaultStyle: { font: 'Helvetica', fontSize: 11, color: SLATE700 },
      content,
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
