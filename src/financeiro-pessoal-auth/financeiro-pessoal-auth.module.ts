import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { FinanceiroPessoalAuthService } from './financeiro-pessoal-auth.service';
import { FinanceiroPessoalAuthController } from './financeiro-pessoal-auth.controller';
import { NivelFinanceiroGuard } from './nivel-financeiro.guard';

// MESMO segredo do login de usuário da Best (JWT_SECRET) — de propósito: o
// token emitido aqui é um JWT de usuário real (paulodick), só que obtido por
// um caminho de login independente (senha própria deste app, nada a ver com
// a senha de login da Best). Isso faz o nível 'entrada' também satisfazer o
// JwtAuthGuard/RolesGuard das rotas /financeiro/* (Best) automaticamente,
// sem precisar de nenhuma rota nova lá.
@Module({
  imports: [
    UsersModule,
    JwtModule.register({
      secret:
        process.env.JWT_SECRET ||
        (process.env.NODE_ENV === 'production'
          ? (() => {
              throw new Error('JWT_SECRET não definido em produção.');
            })()
          : 'dev-secret'),
    }),
  ],
  controllers: [FinanceiroPessoalAuthController],
  providers: [FinanceiroPessoalAuthService, NivelFinanceiroGuard],
  exports: [NivelFinanceiroGuard, JwtModule],
})
export class FinanceiroPessoalAuthModule {}
