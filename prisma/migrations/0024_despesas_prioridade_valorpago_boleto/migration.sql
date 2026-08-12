-- CreateEnum
CREATE TYPE "Prioridade" AS ENUM ('preto', 'vermelho', 'amarelo', 'verde');

-- AlterTable
ALTER TABLE "despesas" ADD COLUMN     "valor_pago_centavos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "prioridade" "Prioridade",
ADD COLUMN     "boleto_arquivo" TEXT,
ADD COLUMN     "boleto_nome" TEXT,
ADD COLUMN     "boleto_em" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "despesas_prioridade_idx" ON "despesas"("prioridade");
