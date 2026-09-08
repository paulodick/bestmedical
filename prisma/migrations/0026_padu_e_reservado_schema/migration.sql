-- Dois novos schemas Postgres, fisicamente separados de "public" e
-- "pessoal": "padu" (Controle Financeiro da Padu Studios) e "reservado"
-- (sub-área da senha Pessoal, liberada só por uma segunda senha).

CREATE SCHEMA IF NOT EXISTS "padu";
CREATE SCHEMA IF NOT EXISTS "reservado";

-- ===== Controle Financeiro — Padu Studios — schema "padu" =====

CREATE TABLE "padu"."despesas_padu" (
    "id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
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

    CONSTRAINT "despesas_padu_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "despesas_padu_data_idx" ON "padu"."despesas_padu"("data");
CREATE INDEX "despesas_padu_pago_idx" ON "padu"."despesas_padu"("pago");

CREATE TABLE "padu"."baixas_despesa_padu" (
    "id" TEXT NOT NULL,
    "despesa_id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "valor_centavos" INTEGER NOT NULL,
    "forma_pagamento" TEXT NOT NULL,
    "observacao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "baixas_despesa_padu_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "baixas_despesa_padu_despesa_id_idx" ON "padu"."baixas_despesa_padu"("despesa_id");

ALTER TABLE "padu"."baixas_despesa_padu" ADD CONSTRAINT "baixas_despesa_padu_despesa_id_fkey"
    FOREIGN KEY ("despesa_id") REFERENCES "padu"."despesas_padu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "padu"."recebiveis_padu" (
    "id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "empresa" TEXT NOT NULL,
    "descricao" TEXT,
    "valor_centavos" INTEGER NOT NULL,
    "valor_pago_centavos" INTEGER NOT NULL DEFAULT 0,
    "pago" BOOLEAN NOT NULL DEFAULT false,
    "data_pagamento" TIMESTAMP(3),
    "condicao_pagamento" TEXT,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recebiveis_padu_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recebiveis_padu_data_idx" ON "padu"."recebiveis_padu"("data");
CREATE INDEX "recebiveis_padu_pago_idx" ON "padu"."recebiveis_padu"("pago");

CREATE TABLE "padu"."baixas_recebivel_padu" (
    "id" TEXT NOT NULL,
    "recebivel_id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "valor_centavos" INTEGER NOT NULL,
    "forma_pagamento" TEXT NOT NULL,
    "observacao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "baixas_recebivel_padu_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "baixas_recebivel_padu_recebivel_id_idx" ON "padu"."baixas_recebivel_padu"("recebivel_id");

ALTER TABLE "padu"."baixas_recebivel_padu" ADD CONSTRAINT "baixas_recebivel_padu_recebivel_id_fkey"
    FOREIGN KEY ("recebivel_id") REFERENCES "padu"."recebiveis_padu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===== Controle Financeiro Pessoal — área reservada — schema "reservado" =====

CREATE TABLE "reservado"."despesas_reservadas" (
    "id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
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

    CONSTRAINT "despesas_reservadas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "despesas_reservadas_data_idx" ON "reservado"."despesas_reservadas"("data");
CREATE INDEX "despesas_reservadas_pago_idx" ON "reservado"."despesas_reservadas"("pago");

CREATE TABLE "reservado"."baixas_despesa_reservada" (
    "id" TEXT NOT NULL,
    "despesa_id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "valor_centavos" INTEGER NOT NULL,
    "forma_pagamento" TEXT NOT NULL,
    "observacao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "baixas_despesa_reservada_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "baixas_despesa_reservada_despesa_id_idx" ON "reservado"."baixas_despesa_reservada"("despesa_id");

ALTER TABLE "reservado"."baixas_despesa_reservada" ADD CONSTRAINT "baixas_despesa_reservada_despesa_id_fkey"
    FOREIGN KEY ("despesa_id") REFERENCES "reservado"."despesas_reservadas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "reservado"."recebiveis_reservados" (
    "id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
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

    CONSTRAINT "recebiveis_reservados_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recebiveis_reservados_data_idx" ON "reservado"."recebiveis_reservados"("data");
CREATE INDEX "recebiveis_reservados_pago_idx" ON "reservado"."recebiveis_reservados"("pago");

CREATE TABLE "reservado"."baixas_recebivel_reservado" (
    "id" TEXT NOT NULL,
    "recebivel_id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "valor_centavos" INTEGER NOT NULL,
    "forma_pagamento" TEXT NOT NULL,
    "observacao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "baixas_recebivel_reservado_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "baixas_recebivel_reservado_recebivel_id_idx" ON "reservado"."baixas_recebivel_reservado"("recebivel_id");

ALTER TABLE "reservado"."baixas_recebivel_reservado" ADD CONSTRAINT "baixas_recebivel_reservado_recebivel_id_fkey"
    FOREIGN KEY ("recebivel_id") REFERENCES "reservado"."recebiveis_reservados"("id") ON DELETE CASCADE ON UPDATE CASCADE;
