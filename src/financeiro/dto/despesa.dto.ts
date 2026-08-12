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

// Cores de prioridade disponíveis na coluna "Prioridade" de Despesas.
export const PRIORIDADES = ['preto', 'vermelho', 'amarelo', 'verde'] as const;
export type PrioridadeDespesa = (typeof PRIORIDADES)[number];

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

  // Quanto já foi pago (pagamento parcial). Saldo devedor = valor - valorPago.
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) valorPago?: number;

  @IsOptional() @IsIn(PRIORIDADES) prioridade?: PrioridadeDespesa;
}

// Atualização parcial (PATCH): todos os campos são opcionais, permitindo
// enviar apenas o que mudou (ex.: { pago: false }) sem reenviar o resto.
export class UpdateDespesaDto {
  @IsOptional() @IsISO8601() data?: string;
  @IsOptional() @IsString() @MaxLength(160) fornecedor?: string;
  @IsOptional() @IsString() @MaxLength(80) categoria?: string;
  @IsOptional() @IsString() @MaxLength(400) descricao?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) valor?: number;
  @IsOptional() @IsBoolean() pago?: boolean;
  @IsOptional() @IsISO8601() dataPagamento?: string;
  @IsOptional() @IsString() @MaxLength(160) projeto?: string;
  @IsOptional() @IsString() @MaxLength(400) observacoes?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) valorPago?: number;
  @IsOptional() @IsIn(PRIORIDADES) prioridade?: PrioridadeDespesa | null;
}

// Upload de boleto (mesmo padrão do contrato assinado: base64 em texto).
export class UploadBoletoDespesaDto {
  @IsString() arquivoBase64!: string;
  @IsOptional() @IsString() nome?: string;
}
