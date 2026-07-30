import { IsArray, IsOptional, IsString } from 'class-validator';

// Resolve os destinatários de um envio (orçamento/proposta/contrato) a
// partir de uma lista de ids de Contato selecionados no modal de envio +
// o id do contato marcado como "principal".
//
// Regra combinada com o usuário:
// - O contato principal recebe o e-mail em "Para" (To).
// - Os demais contatos selecionados recebem em cópia (CC).
// - Quando nenhum principal é marcado, o e-mail é aberto com uma saudação
//   genérica ("Aos prezados representantes da <Razão Social>...") e o
//   primeiro destinatário com e-mail válido assume o campo "Para" (técnico,
//   necessário para o envio) — nenhum deles é tratado como "o" destinatário.

export interface DestinatariosResolvidos {
  // Lista de e-mails que devem ir no campo "Para" (To)
  paraVarios: string[];
  // E-mails em cópia (CC) — os demais selecionados, exceto o(s) já em "Para"
  ccEmails: string[];
  // Havia um contato marcado como principal (e com e-mail válido)?
  temPrincipal: boolean;
  nomePrincipal: string | null;
}

export async function resolverDestinatarios(
  prisma: { contato: { findMany: (args: any) => Promise<any[]> } },
  contatoIds: string[] | undefined,
  principalContatoId: string | null | undefined,
): Promise<DestinatariosResolvidos> {
  const ids = [...new Set((contatoIds || []).filter(Boolean))];
  if (ids.length === 0) {
    return { paraVarios: [], ccEmails: [], temPrincipal: false, nomePrincipal: null };
  }

  const contatos = await prisma.contato.findMany({ where: { id: { in: ids } } });
  const porId = new Map(contatos.map((c: any) => [c.id, c]));

  const selecionados = ids
    .map((id) => porId.get(id))
    .filter((c: any): c is any => !!c && !!(c.email || '').trim());

  const principal =
    principalContatoId ? porId.get(principalContatoId) : undefined;
  const principalTemEmail = !!principal && !!(principal.email || '').trim();

  if (principalTemEmail) {
    const ccEmails = selecionados
      .filter((c: any) => c.id !== principalContatoId)
      .map((c: any) => c.email as string);
    return {
      paraVarios: [principal.email as string],
      ccEmails: [...new Set(ccEmails)],
      temPrincipal: true,
      nomePrincipal: principal.nome ?? null,
    };
  }

  // Sem principal (ou principal sem e-mail): todos os selecionados entram
  // em "Para" (mesmo comportamento já usado pela Ordem de Serviço), e o
  // e-mail usa a saudação genérica.
  return {
    paraVarios: selecionados.map((c: any) => c.email as string),
    ccEmails: [],
    temPrincipal: false,
    nomePrincipal: null,
  };
}

// DTO compartilhado pelos três controllers de envio (orçamento, proposta,
// contrato) — lista de solicitantes selecionados + qual é o principal.
export class EnviarComSolicitantesDto {
  @IsOptional() @IsArray() @IsString({ each: true }) contatoIds?: string[];
  @IsOptional() @IsString() principalContatoId?: string | null;
  // Linha de saudação do e-mail, usada como está (ex.: "À Clínica X" ou
  // "Ao Hospital Y" — artigo escolhido no modal, pois depende do gênero
  // gramatical do nome do cliente). Padrão no front: "À <Razão Social>".
  @IsOptional() @IsString() destinatario?: string;
  // Texto livre exibido no corpo do e-mail após "... referente ...". Já
  // inclui o artigo ("à"/"ao") escolhido pelo usuário no modal de envio
  // (padrão: "à " + primeiro item de Itens e Serviços), editável.
  @IsOptional() @IsString() referenteA?: string;
}
