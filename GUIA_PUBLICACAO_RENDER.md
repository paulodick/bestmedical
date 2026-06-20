# Guia passo a passo — Publicar o backend no Render

Guia simples e direto para colocar o backend no ar (de graça), conectar ao banco
de dados e obter a URL final para ligar ao seu front-end já publicado.

Ao terminar, seus orçamentos ficarão salvos de verdade em um banco de dados, e
seus colegas poderão testar com persistência real.

> Tempo estimado: 15 a 25 minutos. Não precisa cartão de crédito (plano gratuito).

---

## Antes de começar (pré-requisitos)

Você vai precisar de duas contas gratuitas:

1. **GitHub** — para guardar o código: https://github.com
2. **Render** — para hospedar: https://render.com

E do arquivo do backend que eu te entreguei: `best-medical-backend.zip`.

---

## Parte 1 — Colocar o código no GitHub

O Render publica a partir de um repositório. Então primeiro subimos o código.

### Opção mais fácil (pelo site, sem instalar nada)

1. Descompacte o `best-medical-backend.zip` no seu computador. Vai virar uma
   pasta `orcamentos-backend` com os arquivos dentro.
2. Acesse https://github.com/new (logado na sua conta).
3. Em **Repository name**, escreva: `bestmedical-backend`.
4. Deixe como **Private** (recomendado) ou Public, como preferir.
5. Clique em **Create repository**.
6. Na página seguinte, clique no link **"uploading an existing file"**
   (ou vá em **Add file > Upload files**).
7. Arraste **todo o conteúdo de dentro** da pasta `orcamentos-backend`
   (as pastas `src`, `prisma`, e os arquivos `package.json`, `render.yaml`, etc.).
   - Importante: arraste o conteúdo de dentro da pasta, não a pasta inteira.
   - Não precisa enviar `node_modules` nem `dist` (eles não vêm no zip mesmo).
8. Em baixo, clique em **Commit changes**.

Pronto: seu código está no GitHub.

---

## Parte 2 — Publicar no Render usando o Blueprint (automático)

O projeto já vem com um arquivo `render.yaml` que cria **tudo de uma vez**: o
servidor da API + o banco de dados + as variáveis de ambiente.

1. Acesse https://dashboard.render.com (logado).
2. Clique em **New +** (canto superior direito) e escolha **Blueprint**.
3. Clique em **Connect** para ligar sua conta do GitHub (autorize o Render).
4. Selecione o repositório **bestmedical-backend** que você acabou de criar.
5. O Render vai ler o `render.yaml` e mostrar que vai criar:
   - um **Web Service**: `bestmedical-api`
   - um **PostgreSQL** (banco): `bestmedical-db`
6. Clique em **Apply** (ou **Create New Resources**).
7. Aguarde alguns minutos. O Render vai:
   - criar o banco de dados gratuito automaticamente;
   - instalar, compilar e **criar as tabelas** (migrations) sozinho;
   - iniciar o servidor.

Quando o serviço `bestmedical-api` ficar com o status **Live** (verde), está no ar.

> As variáveis de ambiente já são preenchidas pelo `render.yaml`:
> `DATABASE_URL` (conectada ao banco automaticamente), `JWT_SECRET` (gerado),
> `CORS_ORIGIN`, e o usuário admin do seed. Você não precisa digitar nada nessa etapa.

---

## Parte 3 — Criar o usuário de acesso (seed) — uma vez só

O banco começa vazio. Rode o comando que cria o usuário administrador:

1. No painel do Render, abra o serviço **bestmedical-api**.
2. No menu lateral, clique em **Shell**.
3. Digite o comando abaixo e tecle Enter:
   ```
   npm run prisma:seed
   ```
4. Deve aparecer uma mensagem confirmando o usuário admin criado.

Login criado:
- **E-mail:** `admin@bestmedical.com.br`
- **Senha:** `admin123`

> Recomendado trocar a senha depois (veja a Parte 6).

---

## Parte 4 — Pegar a URL final da API

1. Ainda no serviço **bestmedical-api**, no topo da página, aparece a URL
   pública, algo como:
   ```
   https://bestmedical-api.onrender.com
   ```
2. Para testar se está no ar, abra no navegador:
   ```
   https://bestmedical-api.onrender.com/api/v1/health
   ```
   Deve aparecer uma resposta como `{"status":"ok", ...}`.

Guarde essa URL — você vai usá-la no front-end. A URL que o front usa é a URL
acima **com `/api/v1` no final**:
```
https://bestmedical-api.onrender.com/api/v1
```

---

## Parte 5 — Conectar o front-end já publicado

O front-end precisa saber o endereço da API. Isso é feito pela variável
`VITE_API_URL`, definida **antes de gerar o build** do front.

### Se o front está no Vercel / Netlify / Render (Static Site)
1. No painel da plataforma do front, vá em **Environment Variables**.
2. Crie a variável:
   - **Nome:** `VITE_API_URL`
   - **Valor:** `https://bestmedical-api.onrender.com/api/v1`
3. Refaça o deploy (Redeploy) para o front pegar a variável.

### Importante sobre CORS
No backend (Render), a variável `CORS_ORIGIN` precisa conter a URL do seu front.
Ela já vem com `https://bestmedical.pplx.app`. Se o seu front estiver em outro
endereço, ajuste:
1. No Render, abra **bestmedical-api > Environment**.
2. Edite **CORS_ORIGIN** e inclua a URL do front (separe por vírgula se houver
   mais de uma), por exemplo:
   ```
   https://bestmedical.pplx.app,https://seu-front.vercel.app
   ```
3. Salve. O serviço reinicia sozinho.

> Observação sobre a versão pplx.app atual: ela foi publicada em modo
> demonstração (sem `VITE_API_URL`), então continua usando dados de exemplo.
> Para ela passar a salvar de verdade, é preciso gerar um novo build do front com
> a `VITE_API_URL` apontando para a API e republicar.

---

## Parte 6 — Testar e ajustes finais

1. Abra o front-end conectado. Agora deve aparecer a **tela de login**.
2. Entre com `admin@bestmedical.com.br` / `admin123`.
3. Crie um orçamento, salve, e confira no Controle. Recarregue a página: os dados
   devem continuar lá (persistência real).
4. Compartilhe o link do front com seus colegas para testarem.

### Trocar a senha do admin (recomendado)
A senha inicial vem do seed. Para trocar:
1. No Render, abra **bestmedical-api > Environment**.
2. Edite **SEED_ADMIN_PASSWORD** para uma senha nova.
3. Abra o **Shell** e rode novamente:
   ```
   npm run prisma:seed
   ```
   (o seed atualiza/garante o usuário admin).

---

## Dúvidas comuns

- **"O primeiro acesso demora alguns segundos."**
  No plano gratuito, o serviço "dorme" quando fica ocioso e acorda no primeiro
  acesso (pode levar ~30 segundos). É normal no plano free.

- **"Apareceu erro de CORS no navegador."**
  Falta incluir a URL do front em `CORS_ORIGIN` (Parte 5).

- **"O login falha / 'Failed to fetch'."**
  Verifique se a `VITE_API_URL` está correta (com `/api/v1` no final) e se a API
  está **Live** no Render (teste o `/api/v1/health`).

- **"Quero recomeçar o banco do zero."**
  No Render, o banco é o recurso `bestmedical-db`. As tabelas são criadas pelas
  migrations no deploy; o seed cria o usuário. Não há dados sensíveis embutidos.

---

## Resumo rápido (checklist)

1. [ ] Código no GitHub (`bestmedical-backend`).
2. [ ] Render: New > Blueprint > Apply (cria API + banco).
3. [ ] Serviço **Live** (verde).
4. [ ] Shell > `npm run prisma:seed` (cria o admin).
5. [ ] Testar `…/api/v1/health`.
6. [ ] Definir `VITE_API_URL` no front e refazer o build/deploy.
7. [ ] Ajustar `CORS_ORIGIN` no backend com a URL do front.
8. [ ] Login e teste de persistência.
