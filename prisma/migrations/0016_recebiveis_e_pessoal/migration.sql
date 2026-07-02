-- Recebíveis avulsos + Lançamentos financeiros pessoais.
-- Valores em centavos; datas em timestamp.

-- ===== Recebíveis avulsos =====
CREATE TABLE "recebiveis" (
    "id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "empresa" TEXT NOT NULL,
    "cnpj" TEXT,
    "descricao" TEXT,
    "valor_centavos" INTEGER NOT NULL,
    "pago" BOOLEAN NOT NULL DEFAULT false,
    "data_pagamento" TIMESTAMP(3),
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recebiveis_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recebiveis_data_idx" ON "recebiveis"("data");
CREATE INDEX "recebiveis_pago_idx" ON "recebiveis"("pago");

-- ===== Lançamentos financeiros pessoais =====
CREATE TABLE "lancamentos_pessoais" (
    "id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "tipo" TEXT NOT NULL,
    "pessoa" TEXT NOT NULL,
    "categoria" TEXT,
    "descricao" TEXT,
    "valor_centavos" INTEGER NOT NULL,
    "pago" BOOLEAN NOT NULL DEFAULT false,
    "data_pagamento" TIMESTAMP(3),
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lancamentos_pessoais_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lancamentos_pessoais_data_idx" ON "lancamentos_pessoais"("data");
CREATE INDEX "lancamentos_pessoais_tipo_idx" ON "lancamentos_pessoais"("tipo");
CREATE INDEX "lancamentos_pessoais_pessoa_idx" ON "lancamentos_pessoais"("pessoa");
