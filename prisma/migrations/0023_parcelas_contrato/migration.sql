ALTER TABLE "propostas" ADD COLUMN "vigencia_meses" INTEGER NOT NULL DEFAULT 12;

CREATE TABLE "parcelas_contrato" (
    "id" TEXT NOT NULL,
    "proposta_id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "data_vencimento" DATE,
    "condicao_vencimento" TEXT,
    "valor_centavos" INTEGER NOT NULL DEFAULT 0,
    "pago" BOOLEAN NOT NULL DEFAULT false,
    "pago_em" DATE,

    CONSTRAINT "parcelas_contrato_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "parcelas_contrato_proposta_id_idx" ON "parcelas_contrato"("proposta_id");

ALTER TABLE "parcelas_contrato" ADD CONSTRAINT "parcelas_contrato_proposta_id_fkey" FOREIGN KEY ("proposta_id") REFERENCES "propostas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
