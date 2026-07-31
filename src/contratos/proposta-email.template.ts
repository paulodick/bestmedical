import { saudacaoEmail } from '../common/email/saudacao';
// Template HTML do e-mail de envio da proposta de contrato (simples e sóbrio).

export function montarEmailProposta(
  p: any,
  opts: {
    semPrincipal?: boolean;
    nomePrincipal?: string | null;
    referenteA?: string;
    destinatario?: string;
  } = {},
): { assunto: string; html: string } {
  const assunto = `Proposta de Contrato ${p.numero} — Best Medical`;
  const empresa = p.empresa || 'cliente';
  const referenteA = (opts.referenteA || '').trim();

  const html = `
  <div style="font-family: Arial, Helvetica, sans-serif; color:#0f172a; max-width:560px; margin:0 auto;">
    <div style="border-bottom:3px solid #0d7d8a; padding-bottom:12px; margin-bottom:16px;">
      <div style="font-size:18px; font-weight:bold; color:#0f172a;">Best Medical</div>
      <div style="font-size:12px; color:#64748b; font-style:italic;">When uptime matters.</div>
    </div>

    <p style="font-size:14px; line-height:1.6;">
      ${saudacaoEmail({ semPrincipal: opts.semPrincipal, nomePrincipal: opts.nomePrincipal ?? p.solicitante, empresa: p.empresa, destinatario: opts.destinatario })}
    </p>
    <p style="font-size:14px; line-height:1.6;">
      Segue em anexo a proposta de contrato <strong>${p.numero}</strong>${referenteA ? ` referente ${referenteA}` : ''}.
      O documento em PDF contém as condições do atendimento e os valores.
    </p>

    <!-- Sem valores no corpo do e-mail: o total e as condições financeiras
         ficam só no PDF anexado. Número + observações destacados numa caixa
         com borda arredondada, com fonte um pouco menor. -->
    <div style="border:1px solid #e2e8f0; border-radius:10px; padding:14px 16px; margin:16px 0;">
      <table style="width:100%; border-collapse:collapse; font-size:13px;">
        <tr>
          <td style="padding:6px 0; color:#64748b;">Número da proposta</td>
          <td style="padding:6px 0; text-align:right; font-weight:bold;">${p.numero}</td>
        </tr>
        ${
          p.tipoContrato
            ? `<tr><td style="padding:6px 0; color:#64748b; border-top:1px solid #e2e8f0;">Tipo de contrato</td><td style="padding:6px 0; text-align:right; border-top:1px solid #e2e8f0;">${p.tipoContrato}</td></tr>`
            : ''
        }
      </table>
      ${
        p.textoFinal
          ? `<p style="font-size:12px; color:#475569; line-height:1.6; margin:12px 0 0;">${p.textoFinal}</p>`
          : ''
      }
    </div>

    <p style="font-size:14px; line-height:1.6;">
      Ficamos à disposição para qualquer esclarecimento.
    </p>

    <div style="margin-top:24px; padding-top:16px; border-top:1px solid #e2e8f0; text-align:center;">
      <div style="font-size:13px; font-weight:bold; font-style:italic; color:#0d7d8a;">When uptime matters.</div>
      <div style="font-size:11px; color:#94a3b8; margin-top:4px;">Best Medical • chamados@bestmedical.com.br</div>
    </div>
  </div>`;

  return { assunto, html };
}
