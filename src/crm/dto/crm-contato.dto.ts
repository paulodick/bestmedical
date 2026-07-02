import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateCrmContatoDto {
  @IsString()
  @MaxLength(160)
  nome: string;

  @IsOptional() @IsString() @MaxLength(160) empresa?: string;
  @IsOptional() @IsString() @MaxLength(40) telefone?: string;
  @IsOptional() @IsString() @MaxLength(40) telefonePessoal?: string;

  // Cidade e Estado (UF). Ao preencher a cidade, o estado é sugerido
  // automaticamente; cidade ambígua (existe em várias UFs) deixa o estado
  // em branco para ajuste manual.
  @IsOptional() @IsString() @MaxLength(120) cidade?: string;
  @IsOptional() @IsString() @MaxLength(2) estado?: string;

  // E-mail é opcional; aceita vazio (o usuário pode preencher depois).
  @IsOptional() @IsEmail() email?: string;

  // Relacionamento: 1 a 5. Default 1 quando não informado.
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5)
  relacionamento?: number;

  // Pessoal: marca contato como pessoal (não profissional).
  @IsOptional() @IsBoolean() pessoal?: boolean;
}

export class UpdateCrmContatoDto extends CreateCrmContatoDto {}

// ===== Importação em lote (vCard/CSV já parseados no front OU texto bruto) =====
export class ImportarContatoItemDto {
  @IsString() @MaxLength(160) nome: string;
  @IsOptional() @IsString() @MaxLength(160) empresa?: string;
  @IsOptional() @IsString() @MaxLength(40) telefone?: string;
  @IsOptional() @IsString() @MaxLength(40) telefonePessoal?: string;
  @IsOptional() @IsString() @MaxLength(120) cidade?: string;
  @IsOptional() @IsString() @MaxLength(2) estado?: string;
  @IsOptional() @IsString() @MaxLength(160) email?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) relacionamento?: number;
}

// ===== Exclusão em lote (vários contatos selecionados de uma vez) =====
export class ExcluirContatosDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids: string[];
}

export class ImportarContatosDto {
  // Conteúdo bruto de um arquivo .vcf (vCard). O backend faz o parsing.
  @IsOptional() @IsString() vcard?: string;

  // OU lista de contatos já estruturados (parseados no front, ex.: CSV).
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ImportarContatoItemDto)
  contatos?: ImportarContatoItemDto[];
}
