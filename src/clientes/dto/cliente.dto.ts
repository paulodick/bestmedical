import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateClienteDto {
  @IsOptional()
  @IsString()
  @MaxLength(18)
  cnpj?: string;

  @IsString()
  @MaxLength(180)
  nome: string;

  @IsOptional() @IsString() @MaxLength(9) cep?: string;
  @IsOptional() @IsString() @MaxLength(200) endereco?: string;
  @IsOptional() @IsString() @MaxLength(120) bairro?: string;
  @IsOptional() @IsString() @MaxLength(120) cidade?: string;
  @IsOptional() @IsString() @Length(2, 2) estado?: string;
  @IsOptional() @IsString() @MaxLength(60) pais?: string;
}

export class UpdateClienteDto extends CreateClienteDto {}
