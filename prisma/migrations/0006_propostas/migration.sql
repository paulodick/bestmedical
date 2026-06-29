-- CreateTable: propostas
CREATE TABLE "propostas" (
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
    "tipo_contrato" TEXT NOT NULL,
    "condicoes_contrato" TEXT NOT NULL DEFAULT '',
    "condicoes_padrao_snap" TEXT NOT NULL DEFAULT '',
    "observacoes_internas" TEXT NOT NULL DEFAULT '',
    "texto_final" TEXT,
    "desconto_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal_centavos" INTEGER NOT NULL DEFAULT 0,
    "desconto_centavos" INTEGER NOT NULL DEFAULT 0,
    "total_centavos" INTEGER NOT NULL DEFAULT 0,
    "status_enviado" BOOLEAN NOT NULL DEFAULT false,
    "status_aprovado" BOOLEAN NOT NULL DEFAULT false,
    "status_realizado" BOOLEAN NOT NULL DEFAULT false,
    "status_aguardando_peca" BOOLEAN NOT NULL DEFAULT false,
    "status_ordem_servico" BOOLEAN NOT NULL DEFAULT false,
    "status_pagamento_realizado" BOOLEAN NOT NULL DEFAULT false,
    "enviado_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "propostas_pkey" PRIMARY KEY ("id")
);

-- CreateTable: itens_proposta_equip
CREATE TABLE "itens_proposta_equip" (
    "id" TEXT NOT NULL,
    "proposta_id" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "modalidade" TEXT NOT NULL DEFAULT '',
    "marca" TEXT NOT NULL DEFAULT '',
    "marca_outras" TEXT NOT NULL DEFAULT '',
    "modelo" TEXT NOT NULL DEFAULT '',
    "numero_serie" TEXT NOT NULL DEFAULT '',
    "valor_centavos" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "itens_proposta_equip_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX "propostas_numero_key" ON "propostas"("numero");

-- CreateIndex
CREATE INDEX "propostas_data_idx" ON "propostas"("data");

-- CreateIndex
CREATE INDEX "propostas_cliente_id_idx" ON "propostas"("cliente_id");

-- CreateIndex
CREATE INDEX "itens_proposta_equip_proposta_id_idx" ON "itens_proposta_equip"("proposta_id");

-- AddForeignKey
ALTER TABLE "propostas" ADD CONSTRAINT "propostas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propostas" ADD CONSTRAINT "propostas_contato_id_fkey" FOREIGN KEY ("contato_id") REFERENCES "contatos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propostas" ADD CONSTRAINT "propostas_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_proposta_equip" ADD CONSTRAINT "itens_proposta_equip_proposta_id_fkey" FOREIGN KEY ("proposta_id") REFERENCES "propostas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
