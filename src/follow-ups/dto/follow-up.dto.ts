import { IsOptional, IsString, MinLength } from 'class-validator';

// Lista follow-ups de um orçamento OU de uma proposta.
export class ListarFollowUpsDto {
  @IsOptional() @IsString() orcamentoId?: string;
  @IsOptional() @IsString() propostaId?: string;
}

// Cria um follow-up. Deve informar orcamentoId OU propostaId.
export class CreateFollowUpDto {
  @IsOptional() @IsString() orcamentoId?: string;
  @IsOptional() @IsString() propostaId?: string;
  @IsString() @MinLength(1) texto!: string;
}
