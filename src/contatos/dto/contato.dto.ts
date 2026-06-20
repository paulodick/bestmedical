import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateContatoDto {
  @IsString()
  @MaxLength(120)
  nome: string;

  @IsOptional() @IsString() @MaxLength(120) setor?: string;
  @IsOptional() @IsString() @MaxLength(20) telefone?: string;
  @IsOptional() @IsEmail() email?: string;
}

export class UpdateContatoDto extends CreateContatoDto {}
