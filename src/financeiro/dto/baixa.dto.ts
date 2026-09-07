import { Type } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

// Formas de pagamento aceitas ao registrar uma baixa (total ou parcial).
export const FORMAS_PAGAMENTO = [
  'Pix',
  'Boleto',
  'Transferência',
  'Cartão',
  'Dinheiro',
  'Outro',
] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];

// ===== Registrar uma baixa (pagamento/recebimento total ou parcial) =====
// Usado tanto para Despesa quanto Recebível, geral e pessoal — mesmo formato.
export class CreateBaixaDto {
  @IsISO8601()
  data: string;

  @Type(() => Number) @IsNumber() @Min(0.01) valor: number;

  @IsIn(FORMAS_PAGAMENTO) formaPagamento: string;

  @IsOptional() @IsString() @MaxLength(300) observacao?: string;
}
