import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export const STATUS_KEYS = [
  'enviado',
  'aprovado',
  'realizado',
  'aguardandoPeca',
  'ordemServico',
  'pagamentoRealizado',
  'reprovado',
  'pago',
  'atrasado',
  'cancelado',
] as const;

export type StatusKey = (typeof STATUS_KEYS)[number];

export class ListarOrcamentosDto extends PaginationDto {
  @IsOptional() @IsString() clienteId?: string;
  @IsOptional() @IsString() cnpj?: string;
  // data exata yyyy-mm-dd
  @IsOptional() @IsString() data?: string;
  // filtrar por um status verdadeiro
  @IsOptional() @IsIn(STATUS_KEYS as unknown as string[]) status?: StatusKey;
  // ordenação
  @IsOptional()
  @IsIn(['data_desc', 'data_asc', 'numero_desc', 'numero_asc'])
  order?: 'data_desc' | 'data_asc' | 'numero_desc' | 'numero_asc';
}

export class UpdateStatusDto {
  @IsOptional() enviado?: boolean;
  @IsOptional() aprovado?: boolean;
  @IsOptional() realizado?: boolean;
  @IsOptional() aguardandoPeca?: boolean;
  @IsOptional() ordemServico?: boolean;
  @IsOptional() pagamentoRealizado?: boolean;
  @IsOptional() reprovado?: boolean;
  // Status financeiros (Controle Financeiro)
  @IsOptional() pago?: boolean;
  @IsOptional() atrasado?: boolean;
  @IsOptional() cancelado?: boolean;
  // Data prevista do recebimento (yyyy-mm-dd) ou null para limpar
  @IsOptional() @IsString() dataPagamento?: string | null;
}
