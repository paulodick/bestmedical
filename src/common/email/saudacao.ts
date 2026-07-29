// Saudação padrão usada nos e-mails de orçamento, proposta e contrato.
// Quando há um solicitante "principal" definido no envio, o e-mail é
// endereçado diretamente a ele. Quando nenhum principal é selecionado, usa
// uma saudação genérica dirigida à empresa (Razão Social).
export function saudacaoEmail(opts: {
  semPrincipal?: boolean;
  nomePrincipal?: string | null;
  empresa?: string | null;
}): string {
  if (opts.semPrincipal) {
    const empresa = (opts.empresa || '').trim();
    return `Aos prezados representantes da ${empresa || 'empresa'},`;
  }
  const nome = (opts.nomePrincipal || '').trim();
  return `Olá${nome ? `, ${nome}` : ''},`;
}
