# Atualizar o backend no Render para habilitar o PDF

Adicionamos a geração de PDF no servidor (endpoint `GET /orcamentos/:id/pdf`).
Para ativar isso no seu ambiente, é preciso atualizar o código do backend no seu
repositório do GitHub — o Render então republica sozinho.

Não há mudança no banco de dados (nenhuma migration nova). É só atualizar o código.

---

## Opção A — Substituir os arquivos no GitHub (mais simples)

1. Baixe e descompacte o novo `best-medical-backend.zip` (versão com PDF).
2. No seu repositório `bestmedical-backend` no GitHub, faça upload dos arquivos
   atualizados (Add file > Upload files) e confirme (Commit). Os principais novos
   ou alterados são:
   - `package.json` (inclui a biblioteca `pdfmake`)
   - `src/orcamentos/pdf/` (pasta nova: serviço de PDF + logo)
   - `src/orcamentos/orcamentos.controller.ts` (rota do PDF)
   - `src/orcamentos/orcamentos.module.ts`
   - Dica: para não errar, pode subir a pasta inteira do projeto novamente
     (sem `node_modules` e sem `dist`), sobrescrevendo os arquivos.
3. Ao confirmar o commit, o Render detecta a mudança e refaz o deploy
   automaticamente. Aguarde ficar **Live**.

> Como o `package.json` mudou (nova dependência), o Render vai reinstalar as
> dependências no deploy — isso é automático.

---

## Opção B — Se você usa Git no computador

```bash
# dentro da pasta do projeto, com os arquivos novos copiados por cima
git add .
git commit -m "Fase 2: geração de PDF no servidor"
git push
```
O Render republica sozinho após o push.

---

## Testar se o PDF está ativo

Depois do deploy ficar **Live**, o botão **Gerar PDF** passa a funcionar:
- Na tela **Controle de Orçamentos**, cada linha tem um ícone de PDF — clicar
  abre o PDF do orçamento em uma nova aba (gerado pelo servidor).
- Em **Novo Orçamento**, salve primeiro; depois o PDF fica disponível pela tela
  de Controle.

> Observação: no plano gratuito do Render, a primeira geração após o serviço
> "dormir" pode demorar alguns segundos (cold start). É normal.

---

## E o front-end?

O front já está preparado para usar o PDF do servidor. Assim que o backend
atualizado estiver no ar, o botão funciona — sem precisar mexer no front.
