// Template HTML do e-mail de envio da proposta de contrato (simples e sóbrio).

const brl = (v: number) =>
  (v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });

export function montarEmailProposta(p: any): { assunto: string; html: string } {
  const assunto = `Proposta de Contrato ${p.numero} — Best Medical`;
  const empresa = p.empresa || 'cliente';
  const total = brl(p.total);

  const html = `
  <div style="font-family: Arial, Helvetica, sans-serif; color:#0f172a; max-width:560px; margin:0 auto;">
    <div style="border-bottom:3px solid #0d7d8a; padding-bottom:12px; margin-bottom:16px;">
      <div style="font-size:18px; font-weight:bold; color:#0f172a;">Best Medical</div>
      <div style="font-size:12px; color:#64748b;">Manutenção de Equipamentos Médicos</div>
    </div>

    <p style="font-size:14px; line-height:1.6;">
      Olá${p.solicitante ? `, ${p.solicitante}` : ''},
    </p>
    <p style="font-size:14px; line-height:1.6;">
      Segue em anexo a proposta de contrato <strong>${p.numero}</strong> referente à
      ${empresa}. O documento em PDF contém as condições do atendimento e os valores.
    </p>

    <table style="width:100%; border-collapse:collapse; margin:16px 0; font-size:14px;">
      <tr>
        <td style="padding:8px 0; color:#64748b;">Número da proposta</td>
        <td style="padding:8px 0; text-align:right; font-weight:bold;">${p.numero}</td>
      </tr>
      ${
        p.tipoContrato
          ? `<tr><td style="padding:8px 0; color:#64748b;">Tipo de contrato</td><td style="padding:8px 0; text-align:right;">${p.tipoContrato}</td></tr>`
          : ''
      }
      <tr>
        <td style="padding:10px 0; color:#0f172a; font-weight:bold; border-top:1px solid #e2e8f0;">Total mensal</td>
        <td style="padding:10px 0; text-align:right; font-weight:bold; font-size:16px; color:#0d7d8a; border-top:1px solid #e2e8f0;">${total}</td>
      </tr>
    </table>

    ${
      p.textoFinal
        ? `<p style="font-size:13px; color:#475569; line-height:1.6;">${p.textoFinal}</p>`
        : ''
    }

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
