import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface EnvioEmail {
  para: string;
  assunto: string;
  html: string;
  anexoPdf?: { nome: string; conteudo: Buffer };
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger('EmailService');

  // Indica se o e-mail está configurado (há host SMTP)
  get configurado(): boolean {
    return !!process.env.SMTP_HOST;
  }

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

  // Remetente padrão (nome + endereço)
  private get remetente(): string {
    const from = process.env.MAIL_FROM || process.env.SMTP_USER || '';
    const nome = process.env.MAIL_FROM_NAME || 'Best Medical';
    return from ? `"${nome}" <${from}>` : nome;
  }

  // CC fixo (cópia de controle), ex.: chamados@bestmedical.com.br
  private get copia(): string | undefined {
    return process.env.MAIL_CC || undefined;
  }

  async enviar(msg: EnvioEmail): Promise<{ ok: boolean; id?: string }> {
    if (!this.configurado) {
      throw new Error(
        'Envio de e-mail não configurado (defina SMTP_HOST, SMTP_USER, SMTP_PASS).',
      );
    }
    const transporter = this.criarTransporter();

    const info = await transporter.sendMail({
      from: this.remetente,
      to: msg.para,
      cc: this.copia,
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

    this.logger.log(`E-mail enviado: ${info.messageId} -> ${msg.para}`);
    return { ok: true, id: info.messageId };
  }
}
