-- CRM: agenda de contatos independente (importada do celular ou cadastrada à mão).
-- Relacionamento: 1 (sem relacionamento) a 5 (excelente).
CREATE TABLE "crm_contatos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "empresa" TEXT,
    "telefone" TEXT,
    "telefone_pessoal" TEXT,
    "email" TEXT,
    "relacionamento" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_contatos_pkey" PRIMARY KEY ("id")
);
