# Configurar o envio de e-mail (SMTP) no Render

O sistema envia o orçamento para o e-mail do solicitante, com o PDF anexado e
uma cópia (CC) para chamados@bestmedical.com.br. O código já está no servidor;
falta apenas informar os dados de SMTP do seu e-mail.

> Enquanto os dados não forem preenchidos, o botão "Enviar orçamento" mostra um
> aviso de que o envio não está configurado — nada quebra.

---

## O que você precisa ter em mãos (dados de SMTP)

Peça ao seu provedor de e-mail/hospedagem (ou veja no painel do e-mail) estes dados
da conta `chamados@bestmedical.com.br`:

- **Host SMTP** — ex.: `smtp.seuprovedor.com.br`
- **Porta** — geralmente `587` (TLS) ou `465` (SSL)
- **Usuário** — normalmente `chamados@bestmedical.com.br`
- **Senha** — a senha da caixa de e-mail

---

## Passo a passo no Render

1. Acesse https://dashboard.render.com e abra o serviço **bestmedical-api**.
2. No menu lateral, clique em **Environment**.
3. Confira/edite estas variáveis (algumas já vêm criadas pelo blueprint):

| Variável | Valor |
| --- | --- |
| `SMTP_HOST` | o host do seu provedor (ex.: `smtp.seuprovedor.com.br`) |
| `SMTP_PORT` | `587` (ou `465` se o provedor exigir SSL) |
| `SMTP_USER` | `chamados@bestmedical.com.br` |
| `SMTP_PASS` | a senha da caixa de e-mail |
| `MAIL_FROM` | `chamados@bestmedical.com.br` |
| `MAIL_FROM_NAME` | `Best Medical` |
| `MAIL_CC` | `chamados@bestmedical.com.br` |

4. Clique em **Save Changes**. O serviço reinicia sozinho.

---

## Testar

1. No sistema, crie e **salve** um orçamento com o campo **E-mail** preenchido
   (e-mail do solicitante).
2. Clique em **Enviar orçamento**.
3. O solicitante recebe o e-mail com o PDF anexado, e uma cópia chega em
   `chamados@bestmedical.com.br` (assim você controla o que foi enviado).

---

## Dicas e problemas comuns

- **Porta e segurança:** se o provedor pedir SSL, use `SMTP_PORT=465`. Para TLS
  (mais comum), use `587`.
- **Falha de autenticação:** confira usuário e senha. Alguns provedores exigem
  uma "senha de aplicativo" específica (ex.: Gmail/Google Workspace) em vez da
  senha normal.
- **E-mail caindo em spam:** para melhor entrega, configure no DNS do domínio os
  registros **SPF** e **DKIM** (seu provedor de e-mail fornece os valores). Não é
  obrigatório para funcionar, mas melhora muito a entrega.
- **Cold start (plano free):** o primeiro envio após o serviço "dormir" pode
  demorar alguns segundos.

---

## Alternativa: usar um serviço dedicado (Resend/SendGrid)

Se preferir não usar o SMTP do provedor, dá para usar um serviço de envio
dedicado (Resend, SendGrid). Eles também usam SMTP — basta preencher as mesmas
variáveis com os dados que eles fornecem. Me avise se quiser seguir por esse
caminho que eu te oriento.
