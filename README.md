# Best Medical — Backend (Fase 1)

API REST do sistema de orçamentos de visita técnica.
Stack: **NestJS + Prisma + PostgreSQL**, autenticação **JWT**, pronta para
**deploy no Render**. Totalmente compatível com o front-end já existente.

> Fase 1 inclui: autenticação, CRUD de clientes/contatos/orçamentos (com itens e
> parcelas), próximo número, consulta de CEP, e listagem com filtros, busca,
> paginação e ordenação. **Não inclui** (ficou para fase 2): geração de PDF,
> envio real de e-mail, auditoria, dashboards, equipamentos e financeiro avançado.

---

## 1. Estrutura de pastas

```
orcamentos-backend/
├── prisma/
│   ├── schema.prisma            # modelo de dados (6 tabelas + enum)
│   ├── migrations/0001_init/    # migration SQL inicial
│   └── seed.ts                  # cria usuário admin + cliente de exemplo
├── src/
│   ├── main.ts                  # bootstrap, CORS, validação, prefixo /api/v1
│   ├── app.module.ts            # módulo raiz
│   ├── health.controller.ts     # GET /health (Render)
│   ├── prisma/                  # PrismaService (conexão)
│   ├── auth/                    # login JWT, guard, estratégia, /auth/me
│   ├── users/                   # acesso a usuários
│   ├── clientes/                # CRUD de clientes
│   ├── contatos/                # contatos por cliente
│   ├── orcamentos/              # CRUD + itens + parcelas + cálculos oficiais
│   │   └── orcamento.calc.ts    # totais, desconto e parcelas (centavos)
│   ├── cep/                     # proxy ViaCEP
│   └── common/dto/              # paginação compartilhada
├── .env.example                 # modelo de variáveis de ambiente
├── render.yaml                  # blueprint de deploy no Render
└── package.json
```

---

## 2. Variáveis de ambiente

Copie `.env.example` para `.env` e ajuste:

| Variável | Descrição |
| --- | --- |
| `DATABASE_URL` | conexão PostgreSQL |
| `JWT_SECRET` | segredo do token (longo e aleatório) |
| `JWT_EXPIRES_IN` | validade do token (ex.: `7d`) |
| `PORT` | porta HTTP (Render injeta automaticamente) |
| `CORS_ORIGIN` | origens liberadas, separadas por vírgula |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NOME` | admin inicial |

---

## 3. Rodar localmente

Pré-requisitos: Node.js 18+ e um PostgreSQL acessível.

```bash
# 1. instalar dependências (gera o Prisma Client automaticamente)
npm install

# 2. configurar o ambiente
cp .env.example .env       # edite DATABASE_URL e JWT_SECRET

# 3. aplicar as migrations no banco
npm run prisma:deploy      # cria todas as tabelas

# 4. popular o usuário admin (e um cliente de exemplo)
npm run prisma:seed

# 5. iniciar em desenvolvimento (hot reload)
npm run start:dev
```

API disponível em `http://localhost:3000/api/v1`.
Login inicial: `admin@bestmedical.com.br` / `admin123` (configurável no `.env`).

Build de produção:
```bash
npm run build
npm run start:prod
```

---

## 4. Deploy no Render (simples)

Opção A — Blueprint (recomendada):
1. Suba este projeto para um repositório Git (GitHub/GitLab).
2. No Render: **New > Blueprint** e aponte para o repositório.
3. O `render.yaml` cria automaticamente:
   - um **PostgreSQL** gerenciado (`bestmedical-db`);
   - um **Web Service** (`bestmedical-api`) que roda
     `npm install && npm run build && npx prisma migrate deploy` no build e
     `npm run start:prod` na inicialização.
4. Após o primeiro deploy, rode o seed uma vez (Shell do serviço):
   ```bash
   npm run prisma:seed
   ```
5. Ajuste `CORS_ORIGIN` para a URL do seu front (já vem com
   `https://bestmedical.pplx.app`).

Opção B — Manual: crie um PostgreSQL e um Web Service Node apontando os mesmos
comandos de build/start e as variáveis de ambiente acima.

---

## 5. Endpoints (resumo)

Base: `/api/v1` — todas as rotas (exceto `login` e `health`) exigem
`Authorization: Bearer <token>`.

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/health` | status do serviço |
| POST | `/auth/login` | login → `{ accessToken, user }` |
| GET | `/auth/me` | usuário autenticado |
| GET | `/clientes` | listar (busca + paginação) |
| POST | `/clientes` | criar |
| GET | `/clientes/:id` | detalhe (com contatos) |
| PUT | `/clientes/:id` | atualizar |
| DELETE | `/clientes/:id` | remover |
| GET | `/clientes/:id/contatos` | contatos do cliente |
| POST | `/clientes/:id/contatos` | criar contato |
| PUT | `/contatos/:id` | atualizar contato |
| DELETE | `/contatos/:id` | remover contato |
| GET | `/orcamentos` | listar (filtros, busca, ordenação, paginação) |
| GET | `/orcamentos/proximo-numero` | próximo número `ORC-{ano}-{seq}` |
| POST | `/orcamentos` | criar (com itens e parcelas) |
| GET | `/orcamentos/:id` | detalhe completo |
| PUT | `/orcamentos/:id` | atualizar (substitui itens/parcelas) |
| PATCH | `/orcamentos/:id/status` | alterar status (dropdown inline) |
| POST | `/orcamentos/:id/enviar` | marcar como enviado |
| DELETE | `/orcamentos/:id` | remover |
| GET | `/cep/:cep` | consulta de CEP (ViaCEP) |

### Filtros de `GET /orcamentos`
`?busca=texto&clienteId=&cnpj=&data=2026-06-19&status=enviado&order=data_desc&page=1&pageSize=20`

- `status`: `enviado | aprovado | realizado | aguardandoPeca | ordemServico | pagamentoRealizado`
- `order`: `data_desc | data_asc | numero_desc | numero_asc`

Resposta paginada:
```json
{ "data": [ ... ], "total": 42, "page": 1, "pageSize": 20, "totalPages": 3 }
```

---

## 6. Formato dos dados (compatível com o front)

O backend recebe e devolve valores monetários em **reais** (decimal) e datas em
**ISO `yyyy-mm-dd`** — exatamente como o front já usa. Internamente armazena
dinheiro em centavos. Exemplo de orçamento (POST `/orcamentos`):

```json
{
  "numero": "ORC-2026-0006",
  "data": "2026-06-19",
  "cnpj": "12.345.678/0001-90",
  "empresa": "Hospital Santa Clara",
  "cep": "01310-100", "endereco": "Av. Paulista, 1578",
  "bairro": "Bela Vista", "cidade": "São Paulo", "estado": "SP", "pais": "Brasil",
  "solicitante": "Dra. Helena", "setor": "Imagem",
  "telefone": "(11) 98765-4321", "email": "helena@h.com",
  "modalidade": "Ressonância Magnética", "marca": "Siemens",
  "marcaOutras": "", "modelo": "Aera", "numeroSerie": "SN-1",
  "descricaoVisita": "Troca de bobina",
  "descontoPercent": 10, "numParcelas": 4,
  "observacoes": "", "textoFinal": "...",
  "itens": [
    { "codigo": "BOB-1", "item": "Bobina", "quantidade": 1, "valorItem": 18500 }
  ],
  "parcelas": [
    { "numero": 1, "data": "2026-06-25", "valor": 4625 }
  ]
}
```

A resposta devolve `subtotal`, `desconto`, `total` (recalculados no servidor) e as
parcelas normalizadas (datas +30 dias, valores fechando com o total).

---

## 7. Regras de negócio garantidas no servidor

- **Numeração** `ORC-{ano}-{seq}` única por ano.
- **Totais oficiais**: `subtotal`, `desconto`, `total` são sempre recalculados.
- **Marca "Outras"**: `marcaOutras` só é gravado quando `marca = Outras`.
- **Parcelas**: datas seguintes +30 dias; soma das parcelas = total (invariante).
- **Status**: 6 campos booleanos; `enviar` grava `enviadoEm`.
