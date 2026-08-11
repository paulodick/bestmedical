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

// ===== Criação/edição de recebível avulso =====
// Recebimento manual, sem vínculo com orçamento/proposta.
// Valor em reais (o backend converte para centavos).
export class CreateRecebivelDto {
  @IsISO8601()
  data: string;

  @IsString() @MaxLength(160) empresa: string;

  @IsOptional() @IsString() @MaxLength(20) cnpj?: string;
  @IsOptional() @IsString() @MaxLength(400) descricao?: string;

  @Type(() => Number) @IsNumber() @Min(0) valor: number;

  @IsOptional() @IsBoolean() pago?: boolean;
  @IsOptional() @IsISO8601() dataPagamento?: string;
  // Condição de pagamento (texto livre, ex.: "Antecipado", "30 dias") —
  // mutuamente exclusiva com dataPagamento na UI.
  @IsOptional() @IsString() @MaxLength(60) condicaoPagamento?: string;
  @IsOptional() @IsString() @MaxLength(400) observacoes?: string;
}

// Atualização parcial (PATCH): todos os campos são opcionais.
export class UpdateRecebivelDto {
  @IsOptional() @IsISO8601() data?: string;
  @IsOptional() @IsString() @MaxLength(160) empresa?: string;
  @IsOptional() @IsString() @MaxLength(20) cnpj?: string;
  @IsOptional() @IsString() @MaxLength(400) descricao?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) valor?: number;
  @IsOptional() @IsBoolean() pago?: boolean;
  @IsOptional() @IsISO8601() dataPagamento?: string;
  // Condição de pagamento (texto livre) — pode ser enviada como string vazia
  // "" para limpar o campo (o service converte para null).
  @IsOptional() @IsString() @MaxLength(60) condicaoPagamento?: string;
  @IsOptional() @IsString() @MaxLength(400) observacoes?: string;
}
