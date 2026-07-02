-- Login por "usuario" (nome+sobrenome juntos), em minúsculas e único.

-- 1) Adiciona a coluna como nullable para poder popular os registros existentes.
ALTER TABLE "usuarios" ADD COLUMN "usuario" TEXT;

-- 2) Gera um slug base a partir do nome: minúsculo, sem acentos, só letras/números.
--    unaccent pode não existir; usamos translate para os acentos mais comuns do pt-BR.
UPDATE "usuarios"
SET "usuario" = regexp_replace(
  lower(
    translate(
      "nome",
      'àáâãäåèéêëìíîïòóôõöùúûüçñÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÇÑ',
      'aaaaaaeeeeiiiiooooouuuucnaaaaaaeeeeiiiiooooouuuucn'
    )
  ),
  '[^a-z0-9]', '', 'g'
);

-- 3) Garante que a conta do Paulo (admin master) tenha o usuário "paulodick".
UPDATE "usuarios" SET "usuario" = 'paulodick'
WHERE lower("email") = 'paulo@bestmedical.com.br';

-- 4) Evita vazios: quem ficou sem slug recebe um baseado no início do id.
UPDATE "usuarios"
SET "usuario" = 'user' || substr(replace("id"::text, '-', ''), 1, 8)
WHERE "usuario" IS NULL OR "usuario" = '';

-- 5) Resolve colisões: mantém o primeiro e acrescenta sufixo numérico nos demais.
WITH numerados AS (
  SELECT "id",
         "usuario",
         row_number() OVER (PARTITION BY "usuario" ORDER BY "created_at", "id") AS rn
  FROM "usuarios"
)
UPDATE "usuarios" u
SET "usuario" = n."usuario" || (n.rn - 1)::text
FROM numerados n
WHERE u."id" = n."id" AND n.rn > 1;

-- 6) Torna a coluna obrigatória e única.
ALTER TABLE "usuarios" ALTER COLUMN "usuario" SET NOT NULL;
CREATE UNIQUE INDEX "usuarios_usuario_key" ON "usuarios"("usuario");
