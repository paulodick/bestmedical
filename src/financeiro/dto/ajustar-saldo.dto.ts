import { Type } from 'class-transformer';
import { IsNumber } from 'class-validator';

// Ajusta o saldo em caixa exibido no Dashboard: o usuário informa o valor
// real que deveria estar em caixa AGORA, e o backend calcula o ajuste
// interno necessário (ver *.service.ts::ajustarSaldo) para que o saldo
// exibido passe a bater com esse valor.
export class AjustarSaldoDto {
  @Type(() => Number) @IsNumber() saldoAtual: number;
}
