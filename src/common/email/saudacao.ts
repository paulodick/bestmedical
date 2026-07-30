// Saudação padrão usada nos e-mails de orçamento, proposta e contrato.
// Quando o campo "Destinatário" é preenchido no modal de envio (padrão "À
// <Razão Social>", mas editável para "Ao ..." — o artigo depende do gênero
// gramatical do nome do cliente), ele é usado como está. Sem esse campo:
// com um solicitante "principal" definido, usa "À <Razão Social>,"; sem
// principal, usa a saudação genérica "Aos prezados representantes da
// <Razão Social>,".
export function saudacaoEmail(opts: {
  semPrincipal?: boolean;
  nomePrincipal?: string | null;
  empresa?: string | null;
  destinatario?: string | null;
}): string {
  const destinatario = (opts.destinatario || '').trim();
  if (destinatario) {
    return `${destinatario},`;
  }
  const empresa = (opts.empresa || '').trim() || 'empresa';
  if (opts.semPrincipal) {
    return `Aos prezados representantes da ${empresa},`;
  }
  return `À ${empresa},`;
}
