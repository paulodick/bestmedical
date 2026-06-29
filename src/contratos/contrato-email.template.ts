// Template HTML do e-mail de envio do contrato (simples e sóbrio).

export function montarEmailContrato(d: any): { assunto: string; html: string } {
  const assunto = `Contrato ${d.numero} — Best Medical`;
  const empresa = d.empresa || 'cliente';

  const html = `
  <div style="font-family: Arial, Helvetica, sans-serif; color:#0f172a; max-width:560px; margin:0 auto;">
    <div style="border-bottom:3px solid #0d7d8a; padding-bottom:12px; margin-bottom:16px;">
      <div style="font-size:18px; font-weight:bold; color:#0f172a;">Best Medical</div>
      <div style="font-size:12px; color:#64748b;">Manutenção de Equipamentos Médicos</div>
    </div>

    <p style="font-size:14px; line-height:1.6;">
      Olá${d.solicitante ? `, ${d.solicitante}` : ''},
    </p>
    <p style="font-size:14px; line-height:1.6;">
      Segue em anexo o contrato <strong>${d.numero}</strong> referente à ${empresa},
      elaborado a partir da proposta ${d.numeroProposta || ''}. O documento em PDF
      contém as cláusulas e condições acordadas.
    </p>

    <p style="font-size:14px; line-height:1.6;">
      Pedimos a gentileza de revisar o documento. Ficamos à disposição para
      qualquer esclarecimento.
    </p>

    <div style="margin-top:24px; padding-top:16px; border-top:1px solid #e2e8f0; text-align:center;">
      <div style="font-size:13px; font-weight:bold; font-style:italic; color:#0d7d8a;">When uptime matters.</div>
      <div style="font-size:11px; color:#94a3b8; margin-top:4px;">Best Medical • chamados@bestmedical.com.br</div>
    </div>
  </div>`;

  return { assunto, html };
}
