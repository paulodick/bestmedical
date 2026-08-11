-- Condição de pagamento (texto livre, ex.: "Antecipado", "30 dias") como
-- alternativa à data de pagamento quando ainda não há uma data definida.
-- Mutuamente exclusivo com dataPagamento na UI (preencher um desabilita o
-- outro), mas ambos os campos continuam independentes no banco.
ALTER TABLE "orcamentos" ADD COLUMN "condicao_pagamento" TEXT;
ALTER TABLE "recebiveis" ADD COLUMN "condicao_pagamento" TEXT;
