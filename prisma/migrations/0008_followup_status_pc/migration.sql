-- AlterTable: novos status de PC + arquivo do contrato assinado
ALTER TABLE "propostas"
  ADD COLUMN "status_assinado" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "status_vigente" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "status_reprovado" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "contrato_assinado_arquivo" TEXT,
  ADD COLUMN "contrato_assinado_nome" TEXT,
  ADD COLUMN "contrato_assinado_em" TIMESTAMP(3);

-- CreateTable: follow_ups
CREATE TABLE "follow_ups" (
    "id" TEXT NOT NULL,
    "orcamento_id" TEXT,
    "proposta_id" TEXT,
    "autor_id" TEXT,
    "autor_nome" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "follow_ups_orcamento_id_idx" ON "follow_ups"("orcamento_id");

-- CreateIndex
CREATE INDEX "follow_ups_proposta_id_idx" ON "follow_ups"("proposta_id");

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_orcamento_id_fkey" FOREIGN KEY ("orcamento_id") REFERENCES "orcamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_proposta_id_fkey" FOREIGN KEY ("proposta_id") REFERENCES "propostas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
