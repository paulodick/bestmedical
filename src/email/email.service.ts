import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface EnvioEmail {
  para: string;
  assunto: string;
  html: string;
  anexoPdf?: { nome: string; conteudo: Buffer };
  // Múltiplos destinatários (quando presente, substitui 'para' como lista To)
  paraVarios?: string[];
  // CCs extras além do MAIL_CC do servidor (por ex. paulo@bestmedical.com.br)
  ccExtra?: string[];
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger('EmailService');

  // ===== Configuração =====
  // Preferimos a API HTTP do Brevo (contorna o bloqueio de portas SMTP
  // de saída no Render free) e, na ausência dela, caímos no SMTP direto
  // via nodemailer (útil em ambiente local ou em planos pagos do Render).

  private get usaBrevo(): boolean {
    return !!process.env.BREVO_API_KEY;
  }

  // Indica se o e-mail está configurado (Brevo OU SMTP)
  get configurado(): boolean {
    return this.usaBrevo || !!process.env.SMTP_HOST;
  }

  // Remetente: endereço + nome
  private get remetenteEmail(): string {
    return (
      process.env.MAIL_FROM ||
      process.env.SMTP_USER ||
      'no-reply@bestmedical.com.br'
    );
  }

  private get remetenteNome(): string {
    return process.env.MAIL_FROM_NAME || 'Best Medical';
  }

  // Remetente formatado para o nodemailer ("Nome" <email>)
  private get remetenteSmtp(): string {
    const from = this.remetenteEmail;
    const nome = this.remetenteNome;
    return from ? `"${nome}" <${from}>` : nome;
  }

  // CC fixo (cópia de controle), ex.: paulo@bestmedical.com.br
  private get copia(): string | undefined {
    return process.env.MAIL_CC || undefined;
  }

  // Monta a lista de CCs: MAIL_CC + ccExtra, deduplicada, sem strings vazias
  private montarCcs(ccExtra?: string[]): string[] {
    const lista: string[] = [];
    if (this.copia) lista.push(this.copia);
    if (ccExtra) lista.push(...ccExtra);
    // Deduplica e filtra vazios
    return [...new Set(lista.filter(Boolean))];
  }

  async enviar(msg: EnvioEmail): Promise<{ ok: boolean; id?: string }> {
    if (!this.configurado) {
      throw new Error(
        'Envio de e-mail não configurado (defina BREVO_API_KEY ou SMTP_HOST/USER/PASS).',
      );
    }

    if (this.usaBrevo) {
      return this.enviarViaBrevo(msg);
    }
    return this.enviarViaSmtp(msg);
  }

  // ===== Envio via API HTTP do Brevo =====
  private async enviarViaBrevo(
    msg: EnvioEmail,
  ): Promise<{ ok: boolean; id?: string }> {
    const apiKey = process.env.BREVO_API_KEY as string;

    // Lista de destinatários: paraVarios se fornecido, senão [para]
    const destinatarios = msg.paraVarios && msg.paraVarios.length > 0
      ? msg.paraVarios
      : [msg.para];

    const payload: Record<string, unknown> = {
      sender: { email: this.remetenteEmail, name: this.remetenteNome },
      to: destinatarios.map((e) => ({ email: e })),
      subject: msg.assunto,
      htmlContent: msg.html,
    };

    // CCs unificados
    const ccs = this.montarCcs(msg.ccExtra);
    if (ccs.length > 0) {
      payload.cc = ccs.map((e) => ({ email: e }));
    }

    if (msg.anexoPdf) {
      payload.attachment = [
        {
          name: msg.anexoPdf.nome,
          content: msg.anexoPdf.conteudo.toString('base64'),
        },
      ];
    }

    let resp: Response;
    try {
      resp = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      throw new Error(
        'Não foi possível conectar à API do Brevo: ' +
          (e instanceof Error ? e.message : 'erro de rede'),
      );
    }

    if (!resp.ok) {
      const texto = await resp.text().catch(() => '');
      throw new Error(
        `Brevo retornou ${resp.status}: ${texto || resp.statusText}`,
      );
    }

    let id: string | undefined;
    try {
      const data = (await resp.json()) as { messageId?: string };
      id = data?.messageId;
    } catch {
      // resposta sem corpo JSON — tudo bem, o status já foi 2xx
    }

    const paraLog = destinatarios.join(', ');
    this.logger.log(`E-mail enviado via Brevo: ${id ?? '(sem id)'} -> ${paraLog}`);
    return { ok: true, id };
  }

  // ===== Envio via SMTP direto (nodemailer) =====
  private criarTransporter() {
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      // 465 => SSL (secure true); 587 => STARTTLS (secure false)
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  private async enviarViaSmtp(
    msg: EnvioEmail,
  ): Promise<{ ok: boolean; id?: string }> {
    const transporter = this.criarTransporter();

    // Lista de destinatários: paraVarios se fornecido, senão para
    const to = msg.paraVarios && msg.paraVarios.length > 0
      ? msg.paraVarios.join(', ')
      : msg.para;

    // CCs unificados
    const ccs = this.montarCcs(msg.ccExtra);
    const cc = ccs.length > 0 ? ccs.join(', ') : undefined;

    const info = await transporter.sendMail({
      from: this.remetenteSmtp,
      to,
      cc,
      subject: msg.assunto,
      html: msg.html,
      attachments: msg.anexoPdf
        ? [
            {
              filename: msg.anexoPdf.nome,
              content: msg.anexoPdf.conteudo,
              contentType: 'application/pdf',
            },
          ]
        : [],
    });

    this.logger.log(`E-mail enviado via SMTP: ${info.messageId} -> ${to}`);
    return { ok: true, id: info.messageId };
  }
}
