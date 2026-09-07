import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsISO8601,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PRIORIDADES, PrioridadeDespesa } from './despesa.dto';

// ===== Despesa do Controle Financeiro Pessoal (schema "pessoal") =====
// Mesmo formato de CreateDespesaDto, com o campo "pessoa" a mais (de quem é
// a despesa) — mesmo padrão do antigo LancamentoPessoal.
export class CreateDespesaPessoalDto {
  @IsISO8601()
  data: string;

  @IsString() @MaxLength(80) pessoa: string;

  @IsString() @MaxLength(160) fornecedor: string;

  @IsOptional() @IsString() @MaxLength(80) categoria?: string;
  @IsOptional() @IsString() @MaxLength(400) descricao?: string;

  @Type(() => Number) @IsNumber() @Min(0) valor: number;

  @IsOptional() @IsBoolean() pago?: boolean;
  @IsOptional() @IsISO8601() dataPagamento?: string;
  @IsOptional() @IsString() @MaxLength(400) observacoes?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) valorPago?: number;
  @IsOptional() @IsIn(PRIORIDADES) prioridade?: PrioridadeDespesa;
}

export class UpdateDespesaPessoalDto {
  @IsOptional() @IsISO8601() data?: string;
  @IsOptional() @IsString() @MaxLength(80) pessoa?: string;
  @IsOptional() @IsString() @MaxLength(160) fornecedor?: string;
  @IsOptional() @IsString() @MaxLength(80) categoria?: string;
  @IsOptional() @IsString() @MaxLength(400) descricao?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) valor?: number;
  @IsOptional() @IsBoolean() pago?: boolean;
  @IsOptional() @IsISO8601() dataPagamento?: string;
  @IsOptional() @IsString() @MaxLength(400) observacoes?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) valorPago?: number;
  @IsOptional() @IsIn(PRIORIDADES) prioridade?: PrioridadeDespesa | null;
}
