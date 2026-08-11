-- Marca contatos do CRM já atendidos (cliente já teve orçamento/proposta/
-- venda com a Best Medical). Não altera nenhum fluxo existente, é só um
-- marcador manual usado para organizar prospecção.
ALTER TABLE "crm_contatos" ADD COLUMN "atendido" BOOLEAN NOT NULL DEFAULT false;
