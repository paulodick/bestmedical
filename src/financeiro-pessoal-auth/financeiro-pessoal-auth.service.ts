import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CadastrarEntradaDto } from './dto/cadastrar-entrada.dto';
import { EntrarAppDto } from './dto/entrar-app.dto';

// Cascata de 3 níveis do app Financeiro. Cada nível de cima também
// satisfaz os requisitos dos de baixo (ORDEM_NIVEL crescente).
// - 'entrada': abre o app (usuário fixo "paulodick"), mostra o Financeiro
//   Best (espelhado) — o token é um JWT de usuário real da Best (mesmo
//   JWT_SECRET), então também serve pras rotas /financeiro/* existentes.
// - 'pessoal': Financeiro Pessoal.
// - 'secreto': Financeiro Top Secret — só alcançável de dentro do nível
//   'pessoal', pelo gatilho disfarçado (ver front-end).
export type NivelFinanceiro = 'entrada' | 'pessoal' | 'secreto';
export const ORDEM_NIVEL: Record<NivelFinanceiro, number> = {
  entrada: 1,
  pessoal: 2,
  secreto: 3,
};

const ID_CONFIG = 'config';
const USUARIO_APP = 'paulodick';

@Injectable()
export class FinanceiroPessoalAuthService {
  constructor(
    private prisma: PrismaService,
    private users: UsersService,
    private jwt: JwtService,
  ) {}

  private async config() {
    return this.prisma.pessoalAuthConfig.upsert({
      where: { id: ID_CONFIG },
      create: { id: ID_CONFIG },
      update: {},
    });
  }

  private async token(nivel: NivelFinanceiro): Promise<string> {
    const user = await this.users.findByUsuario(USUARIO_APP);
    if (!user || !user.ativo) {
      throw new UnauthorizedException('Usuário do app não configurado.');
    }
    return this.jwt.signAsync(
      {
        sub: user.id,
        usuario: user.usuario,
        email: user.email,
        perfil: user.perfil,
        nivelFinanceiro: nivel,
      },
      { expiresIn: '2h' },
    );
  }

  // ===== Nível 1 — entrada do app =====

  async status(): Promise<{ entradaConfigurada: boolean }> {
    const cfg = await this.config();
    return { entradaConfigurada: !!cfg.senhaEntradaHash };
  }

  async cadastrarEntrada(dto: CadastrarEntradaDto): Promise<{ accessToken: string }> {
    if (dto.usuario.trim().toLowerCase() !== USUARIO_APP) {
      throw new UnauthorizedException('Não disponível.');
    }
    const cfg = await this.config();
    if (cfg.senhaEntradaHash) {
      throw new UnauthorizedException('Não disponível.');
    }
    const [senhaHash, pinHash] = await Promise.all([
      bcrypt.hash(dto.senha, 10),
      bcrypt.hash(dto.pin, 10),
    ]);
    await this.prisma.pessoalAuthConfig.update({
      where: { id: ID_CONFIG },
      data: { senhaEntradaHash: senhaHash, pinRecuperacaoHash: pinHash },
    });
    return { accessToken: await this.token('entrada') };
  }

  async entrarApp(
    dto: EntrarAppDto,
  ): Promise<{ accessToken: string; pessoalConfigurada: boolean }> {
    if (dto.usuario.trim().toLowerCase() !== USUARIO_APP) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    const cfg = await this.config();
    const ok = cfg.senhaEntradaHash
      ? await bcrypt.compare(dto.senha, cfg.senhaEntradaHash)
      : false;
    if (!ok) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    return {
      accessToken: await this.token('entrada'),
      pessoalConfigurada: !!cfg.senhaComumHash,
    };
  }

  // ===== Nível 2 — Financeiro Pessoal =====

  async cadastrarPessoal(senha: string): Promise<{ accessToken: string }> {
    const cfg = await this.config();
    if (cfg.senhaComumHash) {
      throw new UnauthorizedException('Não disponível.');
    }
    const hash = await bcrypt.hash(senha, 10);
    await this.prisma.pessoalAuthConfig.update({
      where: { id: ID_CONFIG },
      data: { senhaComumHash: hash },
    });
    return { accessToken: await this.token('pessoal') };
  }

  async entrarPessoal(senha: string): Promise<{
    accessToken: string;
    secretaConfigurada: boolean;
  }> {
    const cfg = await this.config();
    const ok = cfg.senhaComumHash ? await bcrypt.compare(senha, cfg.senhaComumHash) : false;
    if (!ok) {
      throw new UnauthorizedException('Senha incorreta.');
    }
    return {
      accessToken: await this.token('pessoal'),
      secretaConfigurada: !!cfg.senhaSecretaHash,
    };
  }

  // ===== Nível 3 — Financeiro Top Secret =====

  async cadastrarSecreto(senha: string): Promise<{ accessToken: string }> {
    const cfg = await this.config();
    if (cfg.senhaSecretaHash) {
      throw new UnauthorizedException('Não disponível.');
    }
    const hash = await bcrypt.hash(senha, 10);
    await this.prisma.pessoalAuthConfig.update({
      where: { id: ID_CONFIG },
      data: { senhaSecretaHash: hash },
    });
    return { accessToken: await this.token('secreto') };
  }

  // Gatilho disfarçado — resposta sempre genérica (erro ou sucesso, nada
  // no meio do caminho, nenhuma mensagem diferenciada).
  async entrarSecreto(senha: string): Promise<{ accessToken: string }> {
    const cfg = await this.config();
    const ok = cfg.senhaSecretaHash ? await bcrypt.compare(senha, cfg.senhaSecretaHash) : false;
    if (!ok) {
      throw new UnauthorizedException();
    }
    return { accessToken: await this.token('secreto') };
  }

  // ===== Recuperação — PIN único de 6 dígitos =====
  // Reseta os 3 níveis (não o PIN) para o estado "não configurado" — o
  // dono refaz o cadastro em cascata normalmente a partir da tela de
  // entrada. Nenhum dado financeiro é afetado, só as senhas de acesso.
  async recuperar(pin: string): Promise<{ ok: true }> {
    const cfg = await this.config();
    const ok = cfg.pinRecuperacaoHash
      ? await bcrypt.compare(pin, cfg.pinRecuperacaoHash)
      : false;
    if (!ok) {
      throw new UnauthorizedException('PIN incorreto.');
    }
    await this.prisma.pessoalAuthConfig.update({
      where: { id: ID_CONFIG },
      data: { senhaEntradaHash: null, senhaComumHash: null, senhaSecretaHash: null },
    });
    return { ok: true };
  }
}
