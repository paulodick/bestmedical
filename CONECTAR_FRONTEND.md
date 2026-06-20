# Como conectar o front-end atual a esta API

O objetivo é trocar **apenas** a camada de dados do front (hoje em memória, no
`src/store.tsx`) por chamadas HTTP. **Nenhuma tela, componente ou estilo muda.**
Todos os componentes continuam consumindo o mesmo `useStore()` com a mesma
interface (`orcamentos`, `salvar`, `atualizar`, `remover`).

Resumo: o `store.tsx` deixa de usar `SEED_ORCAMENTOS` e passa a buscar/salvar via
API. Os nomes de campos do JSON da API já são idênticos aos do tipo `Orcamento`
do front (fizemos a serialização no backend para isso).

---

## Passo 1 — Variável de ambiente do front

No projeto do front (`orcamentos-app`), crie um arquivo `.env`:

```
VITE_API_URL=http://localhost:3000/api/v1
```

Em produção, use a URL do Render, por exemplo:
`VITE_API_URL=https://bestmedical-api.onrender.com/api/v1`

---

## Passo 2 — Criar um cliente de API

Crie `src/lib/api.ts`:

```ts
const BASE = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";

// token guardado em memória (sem localStorage para respeitar o sandbox).
// Em produção fora do iframe, pode-se usar localStorage se desejar.
let token: string | null = null;
export const setToken = (t: string | null) => (token = t);

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`API ${res.status}: ${msg}`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  login: (email: string, senha: string) =>
    req<{ accessToken: string; user: any }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, senha }),
    }),

  listarOrcamentos: (params = "") =>
    req<{ data: any[]; total: number; page: number; pageSize: number; totalPages: number }>(
      `/orcamentos${params}`,
    ),
  proximoNumero: () => req<{ numero: string }>("/orcamentos/proximo-numero"),
  criarOrcamento: (o: any) =>
    req<any>("/orcamentos", { method: "POST", body: JSON.stringify(o) }),
  atualizarOrcamento: (id: string, o: any) =>
    req<any>(`/orcamentos/${id}`, { method: "PUT", body: JSON.stringify(o) }),
  atualizarStatus: (id: string, patch: any) =>
    req<any>(`/orcamentos/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  removerOrcamento: (id: string) =>
    req<void>(`/orcamentos/${id}`, { method: "DELETE" }),

  consultarCep: (cep: string) =>
    req<{ cep: string; endereco: string; bairro: string; cidade: string; estado: string }>(
      `/cep/${cep.replace(/\D/g, "")}`,
    ),
};
```

---

## Passo 3 — Adaptar o `store.tsx`

Troque a fonte de dados em memória por chamadas à API. A **interface pública do
store não muda** — então `NovoOrcamento.tsx` e `Controle.tsx` continuam iguais.

```tsx
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Orcamento } from "./types";
import { api } from "./lib/api";

interface Store {
  orcamentos: Orcamento[];
  salvar: (o: Orcamento) => Promise<void>;
  atualizar: (id: string, patch: Partial<Orcamento>) => Promise<void>;
  remover: (id: string) => Promise<void>;
  recarregar: () => Promise<void>;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);

  const recarregar = async () => {
    const r = await api.listarOrcamentos("?order=data_desc&pageSize=100");
    setOrcamentos(r.data as Orcamento[]);
  };

  useEffect(() => {
    recarregar().catch(console.error);
  }, []);

  const store = useMemo<Store>(
    () => ({
      orcamentos,
      salvar: async (o) => {
        // se já existe id no backend, atualiza; senão cria
        const existe = orcamentos.some((p) => p.id === o.id);
        if (existe) await api.atualizarOrcamento(o.id, o);
        else await api.criarOrcamento(o);
        await recarregar();
      },
      atualizar: async (id, patch) => {
        // a página de Controle só altera status -> usa PATCH /status
        await api.atualizarStatus(id, patch);
        await recarregar();
      },
      remover: async (id) => {
        await api.removerOrcamento(id);
        await recarregar();
      },
      recarregar,
    }),
    [orcamentos],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore deve estar dentro de StoreProvider");
  return ctx;
}
```

Observações:
- O campo `id` gerado pelo backend (UUID) substitui o `uid()` local. Ao criar um
  novo orçamento, o backend devolve o objeto com `id` real; o `recarregar()`
  sincroniza a lista. Para "novo orçamento", o `id` local serve só até salvar.
- Os componentes que chamam `salvar/atualizar/remover` podem permanecer iguais;
  se quiser feedback de carregamento, basta `await`.

---

## Passo 4 — Próximo número e CEP (opcional, mas recomendado)

- `NovoOrcamento.tsx` usa `proximoNumero(orcamentos)` localmente. Para usar o
  número oficial do servidor, troque por `await api.proximoNumero()` ao montar a
  tela (mantendo o campo editável).
- `consultarCEP()` (hoje mock em `mock.ts`) pode chamar `api.consultarCep(cep)`.
  O retorno tem os mesmos campos (`endereco`, `bairro`, `cidade`, `estado`).

---

## Passo 5 — Tela de login (mínima)

Como a API exige autenticação, adicione um login simples que chama
`api.login(email, senha)` e guarda o token via `setToken(token)`. Pode ser um
formulário pequeno exibido quando não há token. O restante do app permanece
idêntico.

> Dica para o sandbox/preview: o app atual evita `localStorage`. Mantenha o token
> em memória (como no `api.ts` acima). Em produção (fora do iframe) você pode
> persistir o token em `localStorage` se quiser manter a sessão entre recargas.

---

## O que NÃO muda

- Telas **Novo Orçamento** e **Controle de Orçamentos**: layout, campos, ordem,
  máscaras, grade de itens, parcelamento e visualização/PDF — tudo igual.
- O tipo `Orcamento` do front: os nomes de campos do JSON da API são idênticos
  (`empresa`, `cnpj`, `solicitante`, `itens[].item`, `parcelas[].valor`, os 6
  status booleanos, etc.).
- Os cálculos do `calc.ts` continuam no front para resposta imediata; o servidor
  apenas valida e é a fonte da verdade ao persistir.
```
