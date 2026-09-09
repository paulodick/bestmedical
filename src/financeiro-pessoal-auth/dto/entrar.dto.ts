import { IsString, MinLength } from 'class-validator';

export class EntrarPessoalDto {
  @IsString()
  @MinLength(1)
  senha: string;
}
