import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { FinanceiroPessoalAuthService } from './financeiro-pessoal-auth.service';
import { FinanceiroPessoalAuthController } from './financeiro-pessoal-auth.controller';
import { PessoalTokenGuard } from './pessoal-token.guard';

// Segredo PRÓPRIO, diferente do JWT_SECRET do login de usuário da Best —
// um token desta área nunca deve ser aceito por engano em outra, e vice-versa.
@Module({
  imports: [
    JwtModule.register({
      secret:
        process.env.FINANCEIRO_PESSOAL_JWT_SECRET ||
        (process.env.NODE_ENV === 'production'
          ? (() => {
              throw new Error(
                'FINANCEIRO_PESSOAL_JWT_SECRET não definido em produção.',
              );
            })()
          : 'dev-secret-pessoal'),
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [FinanceiroPessoalAuthController],
  providers: [FinanceiroPessoalAuthService, PessoalTokenGuard],
  exports: [PessoalTokenGuard, JwtModule],
})
export class FinanceiroPessoalAuthModule {}
