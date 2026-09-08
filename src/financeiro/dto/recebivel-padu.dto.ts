import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

// ===== Recebível do Controle Financeiro da Padu Studios (schema "padu") ===
export class CreateRecebivelPaduDto {
  @IsISO8601()
  data: string;

  @IsString() @MaxLength(160) empresa: string;

  @IsOptional() @IsString() @MaxLength(400) descricao?: string;

  @Type(() => Number) @IsNumber() @Min(0) valor: number;

  @IsOptional() @IsBoolean() pago?: boolean;
  @IsOptional() @IsISO8601() dataPagamento?: string;
  @IsOptional() @IsString() @MaxLength(60) condicaoPagamento?: string;
  @IsOptional() @IsString() @MaxLength(400) observacoes?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) valorPago?: number;
}

export class UpdateRecebivelPaduDto {
  @IsOptional() @IsISO8601() data?: string;
  @IsOptional() @IsString() @MaxLength(160) empresa?: string;
  @IsOptional() @IsString() @MaxLength(400) descricao?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) valor?: number;
  @IsOptional() @IsBoolean() pago?: boolean;
  @IsOptional() @IsISO8601() dataPagamento?: string;
  @IsOptional() @IsString() @MaxLength(60) condicaoPagamento?: string;
  @IsOptional() @IsString() @MaxLength(400) observacoes?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) valorPago?: number;
}
