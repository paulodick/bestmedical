-- Cidade e estado (UF) do contato do CRM.
-- Preenchidos na importacao cruzando DDD do telefone e cidade/UF no nome.
ALTER TABLE "crm_contatos" ADD COLUMN "cidade" TEXT;
ALTER TABLE "crm_contatos" ADD COLUMN "estado" VARCHAR(2);
