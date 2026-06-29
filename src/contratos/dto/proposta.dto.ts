import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

// Equipamento coberto pela proposta (1 linha = 1 equipamento).
export class EquipPropostaDto {
  @IsOptional() @IsString() modalidade?: string;
  @IsOptional() @IsString() marca?: string;
  @IsOptional() @IsString() marcaOutras?: string;
  @IsOptional() @IsString() modelo?: string;
  @IsOptional() @IsString() numeroSerie?: string;
  // "Valor do Contrato" (mensal) em reais — convertido para centavos no servidor
  @IsOptional() @Type(() => Number) @IsNumber() valorContrato?: number;
}

export class CreatePropostaDto {
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

  // Modalidade do contrato e condições
  @IsOptional() @IsString() tipoContrato?: string;
  @IsOptional() @IsString() condicoesContrato?: string;
  @IsOptional() @IsString() condicoesPadraoSnap?: string;
  @IsOptional() @IsString() observacoesInternas?: string;

  // Resumo
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100)
  descontoPercent?: number;

  // Finalização
  @IsOptional() @IsString() textoFinal?: string;

  // Status
  @IsOptional() @IsBoolean() enviado?: boolean;

  // Equipamentos cobertos
  @IsOptional() @IsArray() @ValidateNested({ each: true })
  @Type(() => EquipPropostaDto)
  equipamentos?: EquipPropostaDto[];
}

export class UpdatePropostaDto extends CreatePropostaDto {}
