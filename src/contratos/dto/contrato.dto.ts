import { IsOptional, IsString } from 'class-validator';

// Atualização do contrato: o usuário edita o corpo (cláusulas) como texto livre,
// uma cláusula/parágrafo por linha. Opcionalmente envia a data do contrato.
export class UpdateContratoDto {
  // Corpo do contrato efetivamente editado (renderizado no PDF).
  @IsOptional() @IsString() conteudoCustomizado?: string;
  // Data do contrato (ISO yyyy-mm-dd). Se ausente, mantém a atual.
  @IsOptional() @IsString() data?: string;
}
