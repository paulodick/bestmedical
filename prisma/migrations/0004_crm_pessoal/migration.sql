-- Marca contatos pessoais (não profissionais). Permanecem no banco,
-- mas podem ser ocultados por filtro na tela do CRM.
ALTER TABLE "crm_contatos" ADD COLUMN "pessoal" BOOLEAN NOT NULL DEFAULT false;
