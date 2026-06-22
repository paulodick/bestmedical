import { Injectable } from '@nestjs/common';
import PdfPrinter from 'pdfmake';
import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces';
import { LOGO_BASE64 } from '../../orcamentos/pdf/logo.base64';

// Mesmas fontes e cores que o PDF de orçamento.
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

// Formata data ISO para pt-BR
const dataBR = (iso: string) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
};

@Injectable()
export class OsPdfService {
  private printer = new PdfPrinter(fonts);

  // Recebe a OS já serializada (mesmo formato do front)
  gerar(os: any): Promise<Buffer> {
    const marcaExibida =
      os.marca === 'Outras' ? os.marcaOutras || 'Outras' : os.marca;

    const itens = (os.itens || []).filter(
      (it: any) => it.item || it.codigo,
    );

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
            { text: 'ORDEM DE SERVIÇO', bold: true, fontSize: 14, color: SLATE900 },
            {
              text: [
                { text: 'Nº ', color: SLATE600 },
                { text: os.numero || '', bold: true, color: SLATE700 },
              ],
              fontSize: 10,
              margin: [0, 3, 0, 0],
            },
            {
              text: [
                { text: 'Data: ', color: SLATE600 },
                { text: dataBR(os.data), bold: true, color: SLATE700 },
              ],
              fontSize: 10,
            },
          ],
        },
      ],
    });

    // Linha divisória
    content.push({
      canvas: [
        { type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1.4, lineColor: SLATE900 },
      ],
      margin: [0, 6, 0, 10],
    });

    // ===== Cliente + Solicitante =====
    const enderecoLinhas: string[] = [];
    if (os.endereco || os.cidade) {
      const ruaNumero = [os.endereco, os.enderecoNumero].filter(Boolean).join(', ');
      const l1 = [ruaNumero, os.complemento, os.bairro].filter(Boolean).join(' - ');
      const l2 =
        [os.cidade, os.estado].filter(Boolean).join(' - ') +
        (os.cep ? ` — CEP ${os.cep}` : '');
      if (l1) enderecoLinhas.push(l1);
      if (l2.trim()) enderecoLinhas.push(l2);
      if (os.pais) enderecoLinhas.push(os.pais);
    }

    content.push({
      columns: [
        {
          width: '*',
          stack: [
            { text: 'CLIENTE', fontSize: 8, bold: true, color: SLATE400, characterSpacing: 0.5 },
            { text: os.empresa || '—', bold: true, color: SLATE900, margin: [0, 2, 0, 0], lineHeight: 1.2 },
            ...(os.cnpj ? [{ text: `CNPJ: ${os.cnpj}`, color: SLATE600, fontSize: 10, lineHeight: 1.2 }] : []),
            ...enderecoLinhas.map((l) => ({ text: l, color: SLATE600, fontSize: 10, lineHeight: 1.2 })),
          ],
        },
        {
          width: '*',
          stack: [
            { text: 'SOLICITANTE', fontSize: 8, bold: true, color: SLATE400, characterSpacing: 0.5 },
            { text: os.solicitante || '—', bold: true, color: SLATE900, margin: [0, 2, 0, 0], lineHeight: 1.2 },
            ...(os.setor ? [{ text: os.setor, color: SLATE600, fontSize: 10, lineHeight: 1.2 }] : []),
            ...(os.telefone ? [{ text: os.telefone, color: SLATE600, fontSize: 10, lineHeight: 1.2 }] : []),
            ...(os.email ? [{ text: os.email, color: SLATE600, fontSize: 10, lineHeight: 1.2 }] : []),
          ],
        },
      ],
      columnGap: 24,
      margin: [0, 0, 0, 12],
    });

    // ===== Dados do equipamento =====
    const tecnicos: Content[] = [];
    const camposTec: { rotulo: string; valor: string }[] = [];
    if (os.modalidade) camposTec.push({ rotulo: 'MODALIDADE', valor: os.modalidade });
    if (marcaExibida) camposTec.push({ rotulo: 'MARCA', valor: marcaExibida });
    if (os.modelo) camposTec.push({ rotulo: 'MODELO', valor: os.modelo });
    if (os.numeroSerie) camposTec.push({ rotulo: 'Nº DE SÉRIE', valor: os.numeroSerie });

    const cartaoCampo = (campo: { rotulo: string; valor: string }) => ({
      stack: [
        { text: campo.rotulo, fontSize: 7, bold: true, color: SLATE400, characterSpacing: 0.5, margin: [0, 0, 0, 1] },
        { text: campo.valor, fontSize: 10, bold: true, color: SLATE900 },
      ],
      fillColor: '#f8fafc',
      margin: [8, 4, 8, 4],
    });

    const cartaoVazio = () => ({ text: '', border: [false, false, false, false] });

    if (camposTec.length || os.descricaoVisita) {
      tecnicos.push({
        text: 'DADOS DO EQUIPAMENTO',
        fontSize: 8,
        bold: true,
        color: SLATE400,
        characterSpacing: 0.5,
        margin: [0, 0, 0, 4],
      });

      if (camposTec.length) {
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
          layout: {
            hLineWidth: () => 0,
            vLineWidth: () => 0,
            paddingLeft: (i: number) => (i === 0 ? 0 : 3),
            paddingRight: (i: number, node: any) =>
              i === node.table.widths.length - 1 ? 0 : 3,
            paddingTop: () => 2,
            paddingBottom: () => 2,
          },
          margin: [0, 0, 0, 0],
        });
      }

      if (os.descricaoVisita) {
        tecnicos.push({
          table: {
            widths: ['*'],
            body: [
              [
                {
                  stack: [
                    {
                      text: 'DESCRIÇÃO DA VISITA TÉCNICA',
                      fontSize: 7,
                      bold: true,
                      color: SLATE400,
                      characterSpacing: 0.5,
                      margin: [0, 0, 0, 2],
                    },
                    { text: os.descricaoVisita, fontSize: 10, color: SLATE700 },
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

    // ===== Tabela de itens da OS (sem valores) =====
    const itemHeader = [
      { text: 'Código', bold: true, color: SLATE600, fontSize: 9 },
      { text: 'Item', bold: true, color: SLATE600, fontSize: 9 },
      { text: 'Qtd.', bold: true, color: SLATE600, fontSize: 9, alignment: 'center' },
      { text: 'Realizado', bold: true, color: SLATE600, fontSize: 9, alignment: 'center' },
      { text: 'Detalhes', bold: true, color: SLATE600, fontSize: 9 },
    ];

    const itemRows =
      itens.length === 0
        ? [
            [
              {
                text: 'Nenhum item adicionado.',
                color: SLATE400,
                colSpan: 5,
                alignment: 'center',
                margin: [0, 6, 0, 6],
              },
              {},
              {},
              {},
              {},
            ],
          ]
        : itens.map((it: any) => [
            { text: it.codigo || '—', color: SLATE600, fontSize: 10 },
            { text: it.item || '—', color: SLATE700, fontSize: 10 },
            {
              text: String(it.quantidade),
              color: SLATE700,
              fontSize: 10,
              alignment: 'center',
            },
            {
              text: it.realizado ? '✓' : '✗',
              color: it.realizado ? '#16a34a' : SLATE400,
              fontSize: 10,
              alignment: 'center',
            },
            {
              text: it.detalhes || '',
              color: SLATE700,
              fontSize: 10,
            },
          ]);

    content.push({
      table: {
        headerRows: 1,
        widths: ['auto', '*', 'auto', 'auto', '*'],
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
      margin: [0, 0, 0, 12],
    });

    // ===== Descrição do serviço =====
    if (os.descricaoServico) {
      content.push({
        table: {
          widths: ['*'],
          body: [
            [
              {
                stack: [
                  {
                    text: 'DESCRIÇÃO DO SERVIÇO',
                    fontSize: 8,
                    bold: true,
                    color: SLATE400,
                    characterSpacing: 0.5,
                    margin: [0, 0, 0, 4],
                  },
                  { text: os.descricaoServico, fontSize: 10, color: SLATE700 },
                ],
                fillColor: '#f8fafc',
                margin: [8, 6, 8, 6],
              },
            ],
          ],
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 12],
      });
    }

    // ===== Fotos =====
    const fotos = (os.fotos || []).slice(0, 10);
    if (fotos.length > 0) {
      content.push({
        text: 'FOTOS',
        fontSize: 8,
        bold: true,
        color: SLATE400,
        characterSpacing: 0.5,
        margin: [0, 0, 0, 6],
      });

      // Exibe 2 fotos por linha
      for (let i = 0; i < fotos.length; i += 2) {
        const fotoEsq = fotos[i];
        const fotoDir = fotos[i + 1];

        const celulaFoto = (foto: any) => ({
          stack: [
            {
              image: foto.dataUrl,
              width: 220,
              margin: [0, 0, 0, 4],
            },
            ...(foto.legenda
              ? [
                  {
                    text: foto.legenda,
                    fontSize: 9,
                    color: SLATE600,
                    italics: true,
                    alignment: 'center',
                  },
                ]
              : []),
          ],
          alignment: 'center',
          margin: [0, 0, 0, 8],
        });

        content.push({
          columns: [
            { width: '*', ...celulaFoto(fotoEsq) },
            fotoDir
              ? { width: '*', ...celulaFoto(fotoDir) }
              : { width: '*', text: '' },
          ] as any[],
          columnGap: 10,
        } as any);
      }
    }

    // ===== Observações =====
    if (os.observacoes) {
      content.push({
        stack: [
          {
            text: [
              { text: 'Observações: ', bold: true, color: SLATE700 },
              { text: os.observacoes, color: SLATE600 },
            ],
            fontSize: 10,
            margin: [0, 0, 0, 12],
          },
        ],
      });
    }

    // ===== Assinaturas =====
    const blocoAssinatura = (titulo: string, dataUrl?: string) => ({
      width: '*',
      stack: [
        // Se há imagem de assinatura, renderiza acima da linha
        ...(dataUrl
          ? [
              {
                image: dataUrl,
                width: 180,
                margin: [0, 0, 0, 4],
                alignment: 'center',
              },
            ]
          : [
              // Espaço para assinar à mão
              { text: '', margin: [0, 0, 0, 36] },
            ]),
        {
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 0,
              x2: 220,
              y2: 0,
              lineWidth: 0.8,
              lineColor: SLATE400,
            },
          ],
          margin: [0, 0, 0, 4],
        },
        {
          text: titulo,
          fontSize: 9,
          color: SLATE600,
          alignment: 'center',
        },
      ],
      alignment: 'center',
    });

    content.push({
      columns: [
        blocoAssinatura('Assinatura do Cliente', os.assinaturaCliente),
        blocoAssinatura('Assinatura do Técnico', os.assinaturaTecnico),
      ] as any[],
      columnGap: 24,
      margin: [0, 16, 0, 0],
    } as any);

    // ===== Rodapé =====
    content.push({
      stack: [
        {
          text: 'When uptime matters.',
          italics: true,
          bold: true,
          color: TEAL,
          fontSize: 11,
          alignment: 'center',
        },
        {
          text: 'Best Medical • Documento gerado pelo sistema interno de ordens de serviço',
          color: SLATE400,
          fontSize: 9,
          alignment: 'center',
          margin: [0, 2, 0, 0],
        },
      ],
      margin: [0, 24, 0, 0],
    });

    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 40],
      defaultStyle: { font: 'Helvetica', fontSize: 11, color: SLATE700 },
      content,
      // Marca d'água discreta com o logo
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
