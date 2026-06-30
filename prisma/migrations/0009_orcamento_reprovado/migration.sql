-- AlterTable: status "Reprovado" para orçamentos
ALTER TABLE "orcamentos"
  ADD COLUMN "status_reprovado" BOOLEAN NOT NULL DEFAULT false;
