import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ItemDto {
  @IsOptional() @IsString() codigo?: string;
  @IsOptional() @IsString() descricao?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) quantidade?: number;
  // valor em reais (decimal) — convertido para centavos no servidor
  @IsOptional() @Type(() => Number) @IsNumber() valorItem?: number;
}

export class ParcelaDto {
  @Type(() => Number) @IsInt() numero: number;
  // data no formato ISO yyyy-mm-dd (ou vazio)
  @IsOptional() @IsString() data?: string;
  // valor em reais (decimal)
  @IsOptional() @Type(() => Number) @IsNumber() valor?: number;
  @IsOptional() @IsBoolean() pago?: boolean;
}

export class CreateOrcamentoDto {
  // Identificação — numero é opcional (servidor gera se vazio)
  @IsOptional() @IsString() numero?: string;
  @IsOptional() @IsString() data?: string;

  // Vínculo direto OU dados avulsos do cliente/solicitante
  @IsOptional() @IsString() clienteId?: string;
  @IsOptional() @IsString() contatoId?: string;

  // Dados do cliente (se não usar clienteId, o servidor cria/reaproveita)
  @IsOptional() @IsString() cnpj?: string;
  @IsOptional() @IsString() empresa?: string;
  @IsOptional() @IsString() cep?: string;
  @IsOptional() @IsString() endereco?: string;
  // número e complemento do endereço (não confundir com 'numero' do orçamento)
  @IsOptional() @IsString() enderecoNumero?: string;
  @IsOptional() @IsString() complemento?: string;
  @IsOptional() @IsString() bairro?: string;
  @IsOptional() @IsString() cidade?: string;
  @IsOptional() @IsString() estado?: string;
  @IsOptional() @IsString() pais?: string;

  // Solicitante
  @IsOptional() @IsString() solicitante?: string;
  @IsOptional() @IsString() setor?: string;
  @IsOptional() @IsString() telefone?: string;
  @IsOptional() @IsString() email?: string;

  // Dados técnicos
  @IsOptional() @IsString() modalidade?: string;
  @IsOptional() @IsString() marca?: string;
  @IsOptional() @IsString() marcaOutras?: string;
  @IsOptional() @IsString() modelo?: string;
  @IsOptional() @IsString() numeroSerie?: string;
  @IsOptional() @IsString() descricaoVisita?: string;

  // Resumo
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100)
  descontoPercent?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) numParcelas?: number;

  // Finalização
  @IsOptional() @IsString() observacoes?: string;
  @IsOptional() @IsString() textoFinal?: string;

  // Status
  @IsOptional() @IsBoolean() enviado?: boolean;
  @IsOptional() @IsBoolean() aprovado?: boolean;
  @IsOptional() @IsBoolean() realizado?: boolean;
  @IsOptional() @IsBoolean() aguardandoPeca?: boolean;
  @IsOptional() @IsBoolean() ordemServico?: boolean;
  @IsOptional() @IsBoolean() pagamentoRealizado?: boolean;

  // Listas aninhadas
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ItemDto)
  itens?: ItemDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ParcelaDto)
  parcelas?: ParcelaDto[];
}

export class UpdateOrcamentoDto extends CreateOrcamentoDto {}
