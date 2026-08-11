-- Marca contatos do CRM que têm WhatsApp (verificação cruzada manual ou via
-- WhatsApp Web). Mesmo padrão de pessoal/atendido: marcador filtrável.
ALTER TABLE "crm_contatos" ADD COLUMN "tem_whatsapp" BOOLEAN NOT NULL DEFAULT false;
