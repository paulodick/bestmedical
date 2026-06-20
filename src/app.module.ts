import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClientesModule } from './clientes/clientes.module';
import { ContatosModule } from './contatos/contatos.module';
import { OrcamentosModule } from './orcamentos/orcamentos.module';
import { CepModule } from './cep/cep.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ClientesModule,
    ContatosModule,
    OrcamentosModule,
    CepModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
