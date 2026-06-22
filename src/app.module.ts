import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClientesModule } from './clientes/clientes.module';
import { ContatosModule } from './contatos/contatos.module';
import { CrmModule } from './crm/crm.module';
import { OrcamentosModule } from './orcamentos/orcamentos.module';
import { CepModule } from './cep/cep.module';
import { EmailModule } from './email/email.module';
import { HealthController } from './health.controller';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Rate limiting global: 120 requisições por minuto por IP (padrão).
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    ClientesModule,
    ContatosModule,
    CrmModule,
    OrcamentosModule,
    CepModule,
    EmailModule,
  ],
  controllers: [HealthController],
  providers: [
    // Ordem importa: Throttler -> Jwt (autenticação) -> Roles (autorização).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
