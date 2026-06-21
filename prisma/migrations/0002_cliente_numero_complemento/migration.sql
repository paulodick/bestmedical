-- Adiciona número e complemento do endereço ao cadastro de clientes.
-- Esses campos não são preenchidos pela consulta de CEP, mas são
-- reaproveitados (autocompletados) quando já existe orçamento anterior
-- para o mesmo CNPJ.
ALTER TABLE "clientes" ADD COLUMN "numero" TEXT;
ALTER TABLE "clientes" ADD COLUMN "complemento" TEXT;
