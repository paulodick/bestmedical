-- Adiciona a data de início da vigência do contrato na proposta.
-- Enquanto NULL, o contrato não entra no Controle Financeiro
-- (pagamento mensal ainda não ativado).
ALTER TABLE "propostas" ADD COLUMN "inicio_contrato" DATE;
