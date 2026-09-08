import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { montarEmailRedefinirSenhaPessoal } from '../email/email.template';

// 'pessoal' = senha comum (compartilhada com esposa/contador/etc.).
// 'reservado' = sessão elevada, só alcançada a partir de dentro da área
// Pessoal — nunca aceita na porta de entrada. Por design, nenhuma resposta
// desta classe pode diferenciar "senha errada" de "recurso não existe" nem
// vazar, para uma sessão 'pessoal', se a área reservada já foi configurada.
export type EscopoPessoal = 'pessoal' | 'reservado';

const ID_CONFIG = 'config';
const RESET_TOKEN_VALIDADE_MS = 60 * 60 * 1000; // 1h
const EMAIL_RESET = 'paulo@bestmedical.com.br';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class FinanceiroPessoalAuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private email: EmailService,
  ) {}

  private async config() {
    return this.prisma.pessoalAuthConfig.upsert({
      where: { id: ID_CONFIG },
      create: { id: ID_CONFIG },
      update: {},
    });
  }

  // Usado pela tela de entrada pra decidir se mostra "cadastrar" (primeiro
  // acesso de todos) ou "entrar" (senha comum já existe).
  async status(): Promise<{ configurado: boolean }> {
    const cfg = await this.config();
    return { configurado: !!cfg.senhaComumHash };
  }

  // Primeiro cadastro da senha comum — só funciona uma vez (enquanto
  // senhaComumHash for nulo). Depois disso, este endpoint nunca mais tem
  // efeito, como se não existisse.
  async cadastrar(senha: string): Promise<{ accessToken: string }> {
    const cfg = await this.config();
    if (cfg.senhaComumHash) {
      throw new UnauthorizedException('Não disponível.');
    }
    const hash = await bcrypt.hash(senha, 10);
    await this.prisma.pessoalAuthConfig.update({
      where: { id: ID_CONFIG },
      data: { senhaComumHash: hash },
    });
    const accessToken = await this.jwt.signAsync({ escopo: 'pessoal' as const });
    return { accessToken };
  }

  // Login normal — SÓ compara com a senha comum. A senha secreta nunca é
  // aceita aqui, em hipótese alguma (ela só é verificada a partir de dentro,
  // via entrarSecreta). `precisaConfigurarSecreta` avisa o front-end se o
  // clique no cadeado, uma vez lá dentro, deve abrir o cadastro da segunda
  // senha (ainda não existe) ou o gatilho disfarçado de "bug" (já existe).
  async entrar(senha: string): Promise<{
    accessToken: string;
    precisaConfigurarSecreta: boolean;
  }> {
    const cfg = await this.config();
    const ok = cfg.senhaComumHash
      ? await bcrypt.compare(senha, cfg.senhaComumHash)
      : false;
    if (!ok) {
      throw new UnauthorizedException('Senha incorreta.');
    }
    const accessToken = await this.jwt.signAsync({ escopo: 'pessoal' as const });
    return { accessToken, precisaConfigurarSecreta: !cfg.senhaSecretaHash };
  }

  // Cadastro da senha secreta — só chamável já autenticado (escopo
  // 'pessoal'), e só funciona uma vez. Ao registrar, já eleva a sessão
  // atual para 'reservado' (feedback imediato de que funcionou).
  async cadastrarSecreta(senha: string): Promise<{ accessToken: string }> {
    const cfg = await this.config();
    if (cfg.senhaSecretaHash) {
      throw new UnauthorizedException('Não disponível.');
    }
    const hash = await bcrypt.hash(senha, 10);
    await this.prisma.pessoalAuthConfig.update({
      where: { id: ID_CONFIG },
      data: { senhaSecretaHash: hash },
    });
    const accessToken = await this.jwt.signAsync({ escopo: 'reservado' as const });
    return { accessToken };
  }

  // Verificação da senha secreta — único jeito de elevar uma sessão
  // 'pessoal' já aberta para 'reservado'. Resposta sempre no mesmo formato
  // (sucesso ou UnauthorizedException genérica), tanto pra senha errada
  // quanto pra "ainda não configurada" — do lado de fora deve parecer só
  // uma interação que não deu em nada, nunca um erro visível.
  async entrarSecreta(senha: string): Promise<{ accessToken: string }> {
    const cfg = await this.config();
    const ok = cfg.senhaSecretaHash
      ? await bcrypt.compare(senha, cfg.senhaSecretaHash)
      : false;
    if (!ok) {
      throw new UnauthorizedException();
    }
    const accessToken = await this.jwt.signAsync({ escopo: 'reservado' as const });
    return { accessToken };
  }

  // "Esqueci minha senha" — só redefine a senha COMUM. Sempre responde com
  // sucesso (não revela se o e-mail configurado existe/está ativo — aqui
  // nem faria sentido, já que o destino é fixo).
  async esqueciSenha(): Promise<{ ok: true }> {
    const tokenBruto = crypto.randomBytes(32).toString('hex');
    await this.prisma.pessoalAuthConfig.upsert({
      where: { id: ID_CONFIG },
      create: {
        id: ID_CONFIG,
        resetTokenHash: hashToken(tokenBruto),
        resetTokenExpira: new Date(Date.now() + RESET_TOKEN_VALIDADE_MS),
      },
      update: {
        resetTokenHash: hashToken(tokenBruto),
        resetTokenExpira: new Date(Date.now() + RESET_TOKEN_VALIDADE_MS),
      },
    });

    const link = `https://financeiro.bestmedical.com.br/redefinir-senha?token=${tokenBruto}`;
    const { assunto, html } = montarEmailRedefinirSenhaPessoal(link);
    if (this.email.configurado) {
      await this.email.enviar({ para: EMAIL_RESET, assunto, html });
    }
    return { ok: true };
  }

  async redefinirSenha(token: string, novaSenha: string): Promise<{ ok: true }> {
    const cfg = await this.config();
    const valido =
      !!cfg.resetTokenHash &&
      !!cfg.resetTokenExpira &&
      cfg.resetTokenExpira.getTime() > Date.now() &&
      cfg.resetTokenHash === hashToken(token);
    if (!valido) {
      throw new UnauthorizedException('Link inválido ou expirado.');
    }
    const hash = await bcrypt.hash(novaSenha, 10);
    await this.prisma.pessoalAuthConfig.update({
      where: { id: ID_CONFIG },
      data: { senhaComumHash: hash, resetTokenHash: null, resetTokenExpira: null },
    });
    return { ok: true };
  }
}
