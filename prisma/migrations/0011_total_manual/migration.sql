-- Total manual (override) para Orçamentos e Propostas.
-- Quando preenchido, prevalece sobre o total calculado pelos itens/desconto.
ALTER TABLE "orcamentos" ADD COLUMN "total_manual_centavos" INTEGER;
ALTER TABLE "propostas" ADD COLUMN "total_manual_centavos" INTEGER;
