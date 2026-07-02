import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

// ===== Criação/edição de lançamento financeiro pessoal =====
// Controle Financeiro Pessoal (exclusivo do admin master).
// Lançamento livre de receita/despesa por pessoa. Valor em reais.
export class CreateLancamentoPessoalDto {
  @IsISO8601()
  data: string;

  // 'receita' (entrada) ou 'despesa' (saída).
  @IsIn(['receita', 'despesa']) tipo: string;

  // Pessoa a quem o lançamento pertence (ex.: Paulo, Luisa).
  @IsString() @MaxLength(80) pessoa: string;

  @IsOptional() @IsString() @MaxLength(80) categoria?: string;
  @IsOptional() @IsString() @MaxLength(400) descricao?: string;

  @Type(() => Number) @IsNumber() @Min(0) valor: number;

  @IsOptional() @IsBoolean() pago?: boolean;
  @IsOptional() @IsISO8601() dataPagamento?: string;
  @IsOptional() @IsString() @MaxLength(400) observacoes?: string;
}

// Atualização parcial (PATCH): todos os campos são opcionais.
export class UpdateLancamentoPessoalDto {
  @IsOptional() @IsISO8601() data?: string;
  @IsOptional() @IsIn(['receita', 'despesa']) tipo?: string;
  @IsOptional() @IsString() @MaxLength(80) pessoa?: string;
  @IsOptional() @IsString() @MaxLength(80) categoria?: string;
  @IsOptional() @IsString() @MaxLength(400) descricao?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) valor?: number;
  @IsOptional() @IsBoolean() pago?: boolean;
  @IsOptional() @IsISO8601() dataPagamento?: string;
  @IsOptional() @IsString() @MaxLength(400) observacoes?: string;
}
