// ===== Migração única: LancamentoPessoal -> DespesaPessoal/RecebivelPessoal =====
// Roda uma vez, manualmente, no Shell do Render, depois do deploy que cria o
// schema "pessoal" (mesmo padrão do prisma:seed). Não apaga a tabela antiga
// (lancamentos_pessoais) — ela fica como rede de segurança até a validação
// em produção confirmar que os dados migraram certo.
//
// Uso: npx ts-node prisma/migrate-lancamentos-pessoais.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const existentesDespesa = await prisma.despesaPessoal.count();
  const existentesRecebivel = await prisma.recebivelPessoal.count();
  if (existentesDespesa > 0 || existentesRecebivel > 0) {
    console.warn(
      `Já existem ${existentesDespesa} despesas e ${existentesRecebivel} recebíveis pessoais — ` +
        'a migração parece já ter rodado. Abortando para não duplicar. ' +
        'Se quiser forçar mesmo assim, apague este bloco de verificação.',
    );
    return;
  }

  const lancamentos = await prisma.lancamentoPessoal.findMany();
  console.log(`Encontrados ${lancamentos.length} lançamentos pessoais legados.`);

  let despesasCriadas = 0;
  let recebiveisCriados = 0;

  for (const l of lancamentos) {
    const rotulo =
      (l.descricao && l.descricao.trim()) ||
      (l.categoria && l.categoria.trim()) ||
      (l.tipo === 'despesa' ? 'Despesa pessoal' : 'Recebível pessoal');

    if (l.tipo === 'despesa') {
      await prisma.despesaPessoal.create({
        data: {
          data: l.data,
          pessoa: l.pessoa,
          fornecedor: rotulo.slice(0, 160),
          categoria: l.categoria,
          descricao: l.descricao,
          valorCentavos: l.valorCentavos,
          // Sem histórico de baixas pra dados legados: só preserva o total já
          // pago (tudo ou nada, já que o modelo antigo não tinha parcial).
          valorPagoCentavos: l.pago ? l.valorCentavos : 0,
          pago: l.pago,
          dataPagamento: l.dataPagamento,
          observacoes: l.observacoes,
        },
      });
      despesasCriadas++;
    } else {
      await prisma.recebivelPessoal.create({
        data: {
          data: l.data,
          pessoa: l.pessoa,
          origem: rotulo.slice(0, 160),
          descricao: l.descricao,
          valorCentavos: l.valorCentavos,
          valorPagoCentavos: l.pago ? l.valorCentavos : 0,
          pago: l.pago,
          dataPagamento: l.dataPagamento,
          observacoes: l.observacoes,
        },
      });
      recebiveisCriados++;
    }
  }

  console.log(
    `Migração concluída: ${despesasCriadas} despesas pessoais + ${recebiveisCriados} recebíveis pessoais criados.`,
  );
  console.log(
    'A tabela lancamentos_pessoais NÃO foi apagada — confirme os dados nas telas novas antes de removê-la.',
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
