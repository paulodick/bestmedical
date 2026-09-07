-- Baixas (histórico de pagamento/recebimento parcial) para Despesa e
-- Recebível, e novo schema "pessoal" (Controle Financeiro Pessoal),
-- fisicamente separado do schema "public" da empresa.

-- ===== Novo schema Postgres para o Controle Financeiro Pessoal =====
CREATE SCHEMA IF NOT EXISTS "pessoal";

-- ===== Recebível: adiciona campo de valor já recebido (parcial) =====
ALTER TABLE "recebiveis" ADD COLUMN "valor_pago_centavos" INTEGER NOT NULL DEFAULT 0;

-- ===== Baixas de Despesa (schema public) =====
CREATE TABLE "baixas_despesa" (
    "id" TEXT NOT NULL,
    "despesa_id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "valor_centavos" INTEGER NOT NULL,
    "forma_pagamento" TEXT NOT NULL,
    "observacao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "baixas_despesa_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "baixas_despesa_despesa_id_idx" ON "baixas_despesa"("despesa_id");

ALTER TABLE "baixas_despesa" ADD CONSTRAINT "baixas_despesa_despesa_id_fkey"
    FOREIGN KEY ("despesa_id") REFERENCES "despesas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===== Baixas de Recebível (schema public) =====
CREATE TABLE "baixas_recebivel" (
    "id" TEXT NOT NULL,
    "recebivel_id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "valor_centavos" INTEGER NOT NULL,
    "forma_pagamento" TEXT NOT NULL,
    "observacao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "baixas_recebivel_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "baixas_recebivel_recebivel_id_idx" ON "baixas_recebivel"("recebivel_id");

ALTER TABLE "baixas_recebivel" ADD CONSTRAINT "baixas_recebivel_recebivel_id_fkey"
    FOREIGN KEY ("recebivel_id") REFERENCES "recebiveis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===== Controle Financeiro Pessoal — schema "pessoal" =====

CREATE TABLE "pessoal"."despesas_pessoais" (
    "id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "pessoa" TEXT NOT NULL,
    "fornecedor" TEXT NOT NULL,
    "categoria" TEXT,
    "descricao" TEXT,
    "valor_centavos" INTEGER NOT NULL,
    "valor_pago_centavos" INTEGER NOT NULL DEFAULT 0,
    "pago" BOOLEAN NOT NULL DEFAULT false,
    "data_pagamento" TIMESTAMP(3),
    "observacoes" TEXT,
    "prioridade" "public"."Prioridade",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "despesas_pessoais_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "despesas_pessoais_data_idx" ON "pessoal"."despesas_pessoais"("data");
CREATE INDEX "despesas_pessoais_pago_idx" ON "pessoal"."despesas_pessoais"("pago");
CREATE INDEX "despesas_pessoais_pessoa_idx" ON "pessoal"."despesas_pessoais"("pessoa");

CREATE TABLE "pessoal"."baixas_despesa_pessoal" (
    "id" TEXT NOT NULL,
    "despesa_id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "valor_centavos" INTEGER NOT NULL,
    "forma_pagamento" TEXT NOT NULL,
    "observacao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "baixas_despesa_pessoal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "baixas_despesa_pessoal_despesa_id_idx" ON "pessoal"."baixas_despesa_pessoal"("despesa_id");

ALTER TABLE "pessoal"."baixas_despesa_pessoal" ADD CONSTRAINT "baixas_despesa_pessoal_despesa_id_fkey"
    FOREIGN KEY ("despesa_id") REFERENCES "pessoal"."despesas_pessoais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "pessoal"."recebiveis_pessoais" (
    "id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "pessoa" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "descricao" TEXT,
    "valor_centavos" INTEGER NOT NULL,
    "valor_pago_centavos" INTEGER NOT NULL DEFAULT 0,
    "pago" BOOLEAN NOT NULL DEFAULT false,
    "data_pagamento" TIMESTAMP(3),
    "condicao_pagamento" TEXT,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recebiveis_pessoais_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recebiveis_pessoais_data_idx" ON "pessoal"."recebiveis_pessoais"("data");
CREATE INDEX "recebiveis_pessoais_pago_idx" ON "pessoal"."recebiveis_pessoais"("pago");
CREATE INDEX "recebiveis_pessoais_pessoa_idx" ON "pessoal"."recebiveis_pessoais"("pessoa");

CREATE TABLE "pessoal"."baixas_recebivel_pessoal" (
    "id" TEXT NOT NULL,
    "recebivel_id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "valor_centavos" INTEGER NOT NULL,
    "forma_pagamento" TEXT NOT NULL,
    "observacao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "baixas_recebivel_pessoal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "baixas_recebivel_pessoal_recebivel_id_idx" ON "pessoal"."baixas_recebivel_pessoal"("recebivel_id");

ALTER TABLE "pessoal"."baixas_recebivel_pessoal" ADD CONSTRAINT "baixas_recebivel_pessoal_recebivel_id_fkey"
    FOREIGN KEY ("recebivel_id") REFERENCES "pessoal"."recebiveis_pessoais"("id") ON DELETE CASCADE ON UPDATE CASCADE;
