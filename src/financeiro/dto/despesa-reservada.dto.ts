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

// ===== Despesa da área reservada do Controle Financeiro Pessoal =====
// Mesmo formato de CreateDespesaDto, sem os campos de boleto/projeto.
export class CreateDespesaReservadaDto {
  @IsISO8601()
  data: string;

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

export class UpdateDespesaReservadaDto {
  @IsOptional() @IsISO8601() data?: string;
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
