-- CreateTable: contratos
CREATE TABLE "contratos" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "proposta_id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "conteudo_padrao_snap" TEXT NOT NULL DEFAULT '',
    "conteudo_customizado" TEXT NOT NULL DEFAULT '',
    "data_geracao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status_enviado" BOOLEAN NOT NULL DEFAULT false,
    "enviado_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contratos_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX "contratos_numero_key" ON "contratos"("numero");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "contratos_proposta_id_key" ON "contratos"("proposta_id");

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_proposta_id_fkey" FOREIGN KEY ("proposta_id") REFERENCES "propostas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
