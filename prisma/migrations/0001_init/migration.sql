-- CreateEnum
CREATE TYPE "Perfil" AS ENUM ('admin', 'operador', 'visualizador');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "perfil" "Perfil" NOT NULL DEFAULT 'operador',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "cnpj" TEXT,
    "nome" TEXT NOT NULL,
    "cep" TEXT,
    "endereco" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "estado" CHAR(2),
    "pais" TEXT NOT NULL DEFAULT 'Brasil',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contatos" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "setor" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contatos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orcamentos" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "contato_id" TEXT,
    "criado_por" TEXT,
    "cliente_nome_snap" TEXT,
    "cliente_cnpj_snap" TEXT,
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
    "desconto_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "num_parcelas" INTEGER NOT NULL DEFAULT 1,
    "subtotal_centavos" INTEGER NOT NULL DEFAULT 0,
    "desconto_centavos" INTEGER NOT NULL DEFAULT 0,
    "total_centavos" INTEGER NOT NULL DEFAULT 0,
    "observacoes" TEXT,
    "texto_final" TEXT,
    "status_enviado" BOOLEAN NOT NULL DEFAULT false,
    "status_aprovado" BOOLEAN NOT NULL DEFAULT false,
    "status_realizado" BOOLEAN NOT NULL DEFAULT false,
    "status_aguardando_peca" BOOLEAN NOT NULL DEFAULT false,
    "status_ordem_servico" BOOLEAN NOT NULL DEFAULT false,
    "status_pagamento_realizado" BOOLEAN NOT NULL DEFAULT false,
    "enviado_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orcamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_orcamento" (
    "id" TEXT NOT NULL,
    "orcamento_id" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "codigo" TEXT NOT NULL DEFAULT '',
    "descricao" TEXT NOT NULL DEFAULT '',
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "valor_item_centavos" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "itens_orcamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parcelas" (
    "id" TEXT NOT NULL,
    "orcamento_id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "data_vencimento" DATE,
    "valor_centavos" INTEGER NOT NULL DEFAULT 0,
    "pago" BOOLEAN NOT NULL DEFAULT false,
    "pago_em" DATE,

    CONSTRAINT "parcelas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_cnpj_key" ON "clientes"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "orcamentos_numero_key" ON "orcamentos"("numero");

-- CreateIndex
CREATE INDEX "orcamentos_data_idx" ON "orcamentos"("data");

-- CreateIndex
CREATE INDEX "orcamentos_cliente_id_idx" ON "orcamentos"("cliente_id");

-- CreateIndex
CREATE INDEX "itens_orcamento_orcamento_id_idx" ON "itens_orcamento"("orcamento_id");

-- CreateIndex
CREATE INDEX "parcelas_orcamento_id_idx" ON "parcelas"("orcamento_id");

-- AddForeignKey
ALTER TABLE "contatos" ADD CONSTRAINT "contatos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamentos" ADD CONSTRAINT "orcamentos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamentos" ADD CONSTRAINT "orcamentos_contato_id_fkey" FOREIGN KEY ("contato_id") REFERENCES "contatos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamentos" ADD CONSTRAINT "orcamentos_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_orcamento" ADD CONSTRAINT "itens_orcamento_orcamento_id_fkey" FOREIGN KEY ("orcamento_id") REFERENCES "orcamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcelas" ADD CONSTRAINT "parcelas_orcamento_id_fkey" FOREIGN KEY ("orcamento_id") REFERENCES "orcamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

