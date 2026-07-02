/**
 * Configuração do Jest para os testes unitários do back-end.
 *
 * Foco: lógica financeira do serviço de orçamentos (cálculo de totais,
 * descontos e parcelas). São testes de funções puras — não dependem de
 * banco de dados nem do container do NestJS, então rodam rápido no CI.
 */
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Procura apenas arquivos *.spec.ts dentro de src/
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  // Usa o tsconfig do projeto, mas sem exigir type-check estrito nos testes
  // (mais tolerante e mais rápido no CI).
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: { esModuleInterop: true, strict: false },
        isolatedModules: true,
      },
    ],
  },
  clearMocks: true,
  // Cobertura opcional (útil localmente): npm run test:cov
  collectCoverageFrom: ['src/orcamentos/orcamento.calc.ts'],
};
