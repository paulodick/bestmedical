-- Configuração (linha única) da autenticação por senha da área Pessoal.
-- Guarda só hashes bcrypt, nunca senha em texto puro.

CREATE TABLE "pessoal"."pessoal_auth_config" (
    "id" TEXT NOT NULL,
    "senha_comum_hash" TEXT,
    "senha_secreta_hash" TEXT,
    "reset_token_hash" TEXT,
    "reset_token_expira" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pessoal_auth_config_pkey" PRIMARY KEY ("id")
);
