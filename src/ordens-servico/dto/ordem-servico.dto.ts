import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

// DTO de item da OS — inclui campos editáveis (realizado, detalhes) e também
// os campos que podem ser atualizados (codigo, descricao, quantidade).
export class ItemOsDto {
  @IsOptional() @IsString() codigo?: string;
  @IsOptional() @IsString() descricao?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) quantidade?: number;
  @IsOptional() @IsBoolean() realizado?: boolean;
  @IsOptional() @IsString() detalhes?: string;
}

// DTO de foto da OS — dataUrl base64 (jpeg/png) e legenda opcional.
export class FotoOsDto {
  @IsOptional() @IsString() dataUrl?: string;
  @IsOptional() @IsString() legenda?: string;
}

// DTO principal de atualização da OS.
// Campos read-only (numero, data, snapshots) não são atualizados via este DTO.
export class UpdateOrdemServicoDto {
  @IsOptional() @IsString() descricaoServico?: string;
  @IsOptional() @IsString() observacoes?: string;
  @IsOptional() @IsString() assinaturaCliente?: string;
  @IsOptional() @IsString() assinaturaTecnico?: string;

  // Lista completa de itens — substitui os existentes (máx. mantém a ordem)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemOsDto)
  itens?: ItemOsDto[];

  // Lista completa de fotos — substitui as existentes (máx. 10)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FotoOsDto)
  fotos?: FotoOsDto[];
}

// DTO para envio da OS por e-mail.
export class EnviarOsDto {
  @IsArray() @IsString({ each: true }) destinatarios: string[];
}
