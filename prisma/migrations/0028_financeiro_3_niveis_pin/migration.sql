-- App Financeiro: login em cascata de 3 níveis (entrada -> pessoal -> secreta)
-- em vez de dois, e recuperação por PIN único de 6 dígitos em vez de e-mail.

ALTER TABLE "pessoal"."pessoal_auth_config" ADD COLUMN "senha_entrada_hash" TEXT;
ALTER TABLE "pessoal"."pessoal_auth_config" ADD COLUMN "pin_recuperacao_hash" TEXT;
ALTER TABLE "pessoal"."pessoal_auth_config" DROP COLUMN "reset_token_hash";
ALTER TABLE "pessoal"."pessoal_auth_config" DROP COLUMN "reset_token_expira";
