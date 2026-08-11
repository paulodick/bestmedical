-- Mesma coluna condicao_pagamento já adicionada em orcamentos/recebiveis
-- (migration 0020), agora também em propostas, para manter consistência
-- na tabela unificada da página Recebíveis (Controle Financeiro).
ALTER TABLE "propostas" ADD COLUMN "condicao_pagamento" TEXT;
