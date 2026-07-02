import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@bestmedical.com.br';
  const senha = process.env.SEED_ADMIN_PASSWORD || 'admin123';
  const nome = process.env.SEED_ADMIN_NOME || 'Administrador';

  const senhaHash = await bcrypt.hash(senha, 10);

  // Login por usuário (não mais por e-mail). Slug do admin genérico.
  const adminUsuario = 'administrador';
  const admin = await prisma.usuario.upsert({
    where: { usuario: adminUsuario },
    update: {},
    create: { nome, usuario: adminUsuario, email, senhaHash, perfil: 'admin' },
  });
  console.log(`Usuário admin pronto: ${admin.usuario} (senha: ${senha})`);

  // Usuário Paulo — admin master. Login: 'paulodick'.
  const pauloUsuario = 'paulodick';
  const pauloEmail = 'paulo@bestmedical.com.br';
  const pauloSenhaHash = await bcrypt.hash('__SENHA_REMOVIDA__', 10);
  const paulo = await prisma.usuario.upsert({
    where: { usuario: pauloUsuario },
    update: {
      senhaHash: pauloSenhaHash,
      ativo: true,
      perfil: 'admin',
      email: pauloEmail,
    },
    create: {
      nome: 'Paulo Dick',
      usuario: pauloUsuario,
      email: pauloEmail,
      senhaHash: pauloSenhaHash,
      perfil: 'admin',
    },
  });
  console.log(`Usuário Paulo pronto: ${paulo.usuario}`);

  // Cliente de exemplo (opcional)
  const total = await prisma.cliente.count();
  if (total === 0) {
    await prisma.cliente.create({
      data: {
        cnpj: '12.345.678/0001-90',
        nome: 'Hospital Santa Clara',
        cep: '01310-100',
        endereco: 'Av. Paulista, 1578',
        bairro: 'Bela Vista',
        cidade: 'São Paulo',
        estado: 'SP',
        pais: 'Brasil',
        contatos: {
          create: {
            nome: 'Dra. Helena Martins',
            setor: 'Diagnóstico por Imagem',
            telefone: '(11) 98765-4321',
            email: 'helena.martins@santaclara.com.br',
          },
        },
      },
    });
    console.log('Cliente de exemplo criado.');
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
