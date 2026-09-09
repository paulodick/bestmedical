import { IsString, MinLength } from 'class-validator';

export class CadastrarPessoalDto {
  @IsString()
  @MinLength(6)
  senha: string;
}
