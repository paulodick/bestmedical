import { Injectable } from '@nestjs/common';
import PdfPrinter from 'pdfmake';
import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces';
import { LOGO_BASE64 } from '../../orcamentos/pdf/logo.base64';
import { CONTRATADA } from '../contrato-template';

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

const dataBR = (iso: string) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
};

const comarca = (cidade?: string, estado?: string) => {
  const c = (cidade || '').trim();
  const uf = (estado || '').trim();
  if (c && uf) return `${c}/${uf}`;
  if (c) return c;
  return '____________';
};

@Injectable()
export class ContratoPdfService {
  private printer = new PdfPrinter(fonts);

  // Recebe os dados consolidados do contrato (ver ContratoService.dadosParaPdf).
  gerar(d: any): Promise<Buffer> {
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
            { text: 'CONTRATO', bold: true, fontSize: 13, color: SLATE900 },
            {
              text: [
                { text: 'Nº ', color: SLATE600 },
                { text: d.numero || '', bold: true, color: SLATE700 },
              ],
              fontSize: 10,
              margin: [0, 3, 0, 0],
            },
            {
              text: [
                { text: 'Data: ', color: SLATE600 },
                { text: dataBR(d.data), bold: true, color: SLATE700 },
              ],
              fontSize: 10,
            },
            ...(d.numeroProposta
              ? [
                  {
                    text: [
                      { text: 'Proposta: ', color: SLATE600 },
                      { text: d.numeroProposta, bold: true, color: SLATE700 },
                    ],
                    fontSize: 10,
                  },
                ]
              : []),
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

    // ===== Título =====
    content.push({
      text: 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS TÉCNICOS',
      bold: true,
      fontSize: 14,
      color: SLATE900,
      alignment: 'center',
      margin: [0, 0, 0, 14],
    });

    // ===== Corpo (texto editável, uma cláusula/parágrafo por linha) =====
    // Linhas em CAIXA ALTA (sem bullet) viram títulos de cláusula; linhas
    // iniciadas por "• " ou "- " viram bullets; as demais, parágrafos.
    const linhas = String(d.conteudo || '').split('\n');
    for (const linha of linhas) {
      const t = linha.trim();
      if (!t) {
        content.push({ text: ' ', margin: [0, 0, 0, 2] });
        continue;
      }
      const ehBullet = t.startsWith('•') || t.startsWith('-');
      const ehTitulo = !ehBullet && t === t.toUpperCase();
      if (ehTitulo) {
        content.push({
          text: t,
          bold: true,
          color: TEAL,
          fontSize: 11,
          margin: [0, 8, 0, 4],
        });
      } else if (ehBullet) {
        const texto = t.replace(/^[•-]\s*/, '');
        content.push({
          columns: [
            { width: 12, text: '•', color: TEAL },
            {
              width: '*',
              text: texto,
              color: SLATE700,
              fontSize: 10,
              alignment: 'justify',
              lineHeight: 1.25,
            },
          ],
          margin: [8, 0, 0, 3],
        });
      } else {
        content.push({
          text: t,
          color: SLATE700,
          fontSize: 10,
          alignment: 'justify',
          lineHeight: 1.3,
          margin: [0, 0, 0, 5],
        });
      }
    }

    // ===== Local e data =====
    content.push({
      text: `${comarca(d.cidade, d.estado)}, ____ de _______________ de 20____.`,
      color: SLATE700,
      fontSize: 10,
      alignment: 'right',
      margin: [0, 18, 0, 30],
    });

    // ===== Assinaturas =====
    content.push({
      columns: [
        {
          width: '*',
          stack: [
            { text: '_____________________________________', alignment: 'center', color: SLATE700 },
            { text: 'CONTRATANTE', bold: true, alignment: 'center', fontSize: 9, color: SLATE900, margin: [0, 4, 0, 0] },
            { text: d.empresa || '', alignment: 'center', fontSize: 8.5, color: SLATE600, margin: [0, 2, 0, 0] },
            ...(d.cnpj ? [{ text: `CNPJ ${d.cnpj}`, alignment: 'center', fontSize: 8.5, color: SLATE600 } as Content] : []),
          ],
        },
        {
          width: '*',
          stack: [
            { text: '_____________________________________', alignment: 'center', color: SLATE700 },
            { text: 'CONTRATADA', bold: true, alignment: 'center', fontSize: 9, color: SLATE900, margin: [0, 4, 0, 0] },
            { text: CONTRATADA.razaoSocial, alignment: 'center', fontSize: 8.5, color: SLATE600, margin: [0, 2, 0, 0] },
            { text: `CNPJ ${CONTRATADA.cnpj}`, alignment: 'center', fontSize: 8.5, color: SLATE600 },
            { text: CONTRATADA.representante, alignment: 'center', fontSize: 8.5, color: SLATE600 },
            { text: `CPF ${CONTRATADA.cpfRepresentante}`, alignment: 'center', fontSize: 8.5, color: SLATE600 },
          ],
        },
      ],
      columnGap: 24,
      margin: [0, 0, 0, 24],
    });

    // ===== Testemunhas =====
    content.push({
      text: 'Testemunhas:',
      bold: true,
      color: SLATE700,
      fontSize: 10,
      margin: [0, 8, 0, 6],
    });
    content.push({
      text: '1. _____________________________   Nome: _______________________   CPF: ________________',
      color: SLATE600,
      fontSize: 9.5,
      margin: [0, 0, 0, 6],
    });
    content.push({
      text: '2. _____________________________   Nome: _______________________   CPF: ________________',
      color: SLATE600,
      fontSize: 9.5,
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
