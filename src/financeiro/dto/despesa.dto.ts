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

// ===== Criação/edição de despesa =====
// Valor em reais (o backend converte para centavos).
export class CreateDespesaDto {
  // Data de competência/vencimento (ISO yyyy-mm-dd).
  @IsISO8601()
  data: string;

  @IsString() @MaxLength(160) fornecedor: string;

  @IsOptional() @IsString() @MaxLength(80) categoria?: string;
  @IsOptional() @IsString() @MaxLength(400) descricao?: string;

  @Type(() => Number) @IsNumber() @Min(0) valor: number;

  @IsOptional() @IsBoolean() pago?: boolean;

  // Data em que foi paga (ISO yyyy-mm-dd). Opcional.
  @IsOptional() @IsISO8601() dataPagamento?: string;

  @IsOptional() @IsString() @MaxLength(160) projeto?: string;
  @IsOptional() @IsString() @MaxLength(400) observacoes?: string;
}

export class UpdateDespesaDto extends CreateDespesaDto {}
