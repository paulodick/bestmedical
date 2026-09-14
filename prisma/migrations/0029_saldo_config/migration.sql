-- Saldo em caixa editável: uma linha de ajuste por escopo (Best, Pessoal,
-- Reservado), somada à soma de entradas/saídas registradas para permitir
-- corrigir o saldo exibido no Dashboard.

CREATE TABLE "public"."saldo_config_best" (
    "id" TEXT NOT NULL,
    "saldo_inicial_centavos" INTEGER NOT NULL DEFAULT 0,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saldo_config_best_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pessoal"."saldo_config_pessoal" (
    "id" TEXT NOT NULL,
    "saldo_inicial_centavos" INTEGER NOT NULL DEFAULT 0,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saldo_config_pessoal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reservado"."saldo_config_reservado" (
    "id" TEXT NOT NULL,
    "saldo_inicial_centavos" INTEGER NOT NULL DEFAULT 0,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saldo_config_reservado_pkey" PRIMARY KEY ("id")
);
