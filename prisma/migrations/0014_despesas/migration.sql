-- Despesas (Controle Financeiro): registro de saídas / contas a pagar.
-- Valor em centavos; data e data_pagamento em timestamp.
CREATE TABLE "despesas" (
    "id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "fornecedor" TEXT NOT NULL,
    "categoria" TEXT,
    "descricao" TEXT,
    "valor_centavos" INTEGER NOT NULL,
    "pago" BOOLEAN NOT NULL DEFAULT false,
    "data_pagamento" TIMESTAMP(3),
    "projeto" TEXT,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "despesas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "despesas_data_idx" ON "despesas"("data");
CREATE INDEX "despesas_pago_idx" ON "despesas"("pago");
