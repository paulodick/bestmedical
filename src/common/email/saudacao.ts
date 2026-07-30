// Saudação padrão usada nos e-mails de orçamento, proposta e contrato.
// Quando há um solicitante "principal" definido no envio, o e-mail é
// endereçado formalmente à empresa ("À <Razão Social>,"). Quando nenhum
// principal é selecionado, usa uma saudação genérica também dirigida à
// empresa ("Aos prezados representantes da <Razão Social>,").
export function saudacaoEmail(opts: {
  semPrincipal?: boolean;
  nomePrincipal?: string | null;
  empresa?: string | null;
}): string {
  const empresa = (opts.empresa || '').trim() || 'empresa';
  if (opts.semPrincipal) {
    return `Aos prezados representantes da ${empresa},`;
  }
  return `À ${empresa},`;
}
