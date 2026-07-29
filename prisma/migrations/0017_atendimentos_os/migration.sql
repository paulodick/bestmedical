-- Conjuntos de atendimento da OS (data + técnico + descrição, quantidade
-- ilimitada). Substitui o uso do campo único "descricao_servico" na tela,
-- que é preservado na tabela apenas como histórico/segurança.

-- Necessário para gerar UUID no INSERT de migração de dados abaixo
-- (extensão padrão, já disponível nos planos gerenciados do Render).
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateTable: atendimentos_os
CREATE TABLE "atendimentos_os" (
    "id" TEXT NOT NULL,
    "ordem_id" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "data" DATE NOT NULL,
    "tecnico" TEXT NOT NULL DEFAULT '',
    "descricao" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "atendimentos_os_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "atendimentos_os_ordem_id_idx" ON "atendimentos_os"("ordem_id");

-- AddForeignKey
ALTER TABLE "atendimentos_os" ADD CONSTRAINT "atendimentos_os_ordem_id_fkey" FOREIGN KEY ("ordem_id") REFERENCES "ordens_servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migração de dados: qualquer OS existente que já tenha texto em
-- "descricao_servico" e ainda não tenha nenhum atendimento cadastrado ganha
-- um primeiro atendimento com esse texto (data da própria OS, técnico em
-- branco), preservando o histórico já registrado.
INSERT INTO "atendimentos_os" ("id", "ordem_id", "ordem", "data", "tecnico", "descricao")
SELECT gen_random_uuid()::text, os."id", 0, os."data", '', os."descricao_servico"
FROM "ordens_servico" os
WHERE os."descricao_servico" IS NOT NULL
  AND btrim(os."descricao_servico") <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "atendimentos_os" a WHERE a."ordem_id" = os."id"
  );
