-- CreateTable: ordens_servico
CREATE TABLE "ordens_servico" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "orcamento_id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "cliente_nome_snap" TEXT,
    "cliente_cnpj_snap" TEXT,
    "cep" TEXT,
    "endereco" TEXT,
    "endereco_numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "pais" TEXT DEFAULT 'Brasil',
    "solicitante_snap" TEXT,
    "setor_snap" TEXT,
    "telefone_snap" TEXT,
    "email_snap" TEXT,
    "modalidade" TEXT,
    "marca" TEXT,
    "marca_outras" TEXT,
    "modelo" TEXT,
    "numero_serie" TEXT,
    "descricao_visita" TEXT,
    "descricao_servico" TEXT,
    "observacoes" TEXT,
    "assinatura_cliente" TEXT,
    "assinatura_tecnico" TEXT,
    "status_enviado" BOOLEAN NOT NULL DEFAULT false,
    "enviado_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ordens_servico_pkey" PRIMARY KEY ("id")
);

-- CreateTable: itens_os
CREATE TABLE "itens_os" (
    "id" TEXT NOT NULL,
    "ordem_id" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "codigo" TEXT NOT NULL DEFAULT '',
    "descricao" TEXT NOT NULL DEFAULT '',
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "realizado" BOOLEAN NOT NULL DEFAULT false,
    "detalhes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "itens_os_pkey" PRIMARY KEY ("id")
);

-- CreateTable: fotos_os
CREATE TABLE "fotos_os" (
    "id" TEXT NOT NULL,
    "ordem_id" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "data_url" TEXT NOT NULL,
    "legenda" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "fotos_os_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX "ordens_servico_numero_key" ON "ordens_servico"("numero");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "ordens_servico_orcamento_id_key" ON "ordens_servico"("orcamento_id");

-- CreateIndex
CREATE INDEX "itens_os_ordem_id_idx" ON "itens_os"("ordem_id");

-- CreateIndex
CREATE INDEX "fotos_os_ordem_id_idx" ON "fotos_os"("ordem_id");

-- AddForeignKey
ALTER TABLE "ordens_servico" ADD CONSTRAINT "ordens_servico_orcamento_id_fkey" FOREIGN KEY ("orcamento_id") REFERENCES "orcamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_os" ADD CONSTRAINT "itens_os_ordem_id_fkey" FOREIGN KEY ("ordem_id") REFERENCES "ordens_servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos_os" ADD CONSTRAINT "fotos_os_ordem_id_fkey" FOREIGN KEY ("ordem_id") REFERENCES "ordens_servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
