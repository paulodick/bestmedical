-- Status financeiros (página Controle Financeiro) para Orçamentos e Propostas.
-- Pago / Atrasado / Cancelado + data prevista do recebimento.
ALTER TABLE "orcamentos" ADD COLUMN "status_pago" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "orcamentos" ADD COLUMN "status_atrasado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "orcamentos" ADD COLUMN "status_cancelado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "orcamentos" ADD COLUMN "data_pagamento" DATE;

ALTER TABLE "propostas" ADD COLUMN "status_pago" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "propostas" ADD COLUMN "status_atrasado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "propostas" ADD COLUMN "status_cancelado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "propostas" ADD COLUMN "data_pagamento" DATE;
