import { IsString, Matches, MinLength } from 'class-validator';

export class CadastrarEntradaDto {
  @IsString()
  @MinLength(1)
  usuario: string;

  @IsString()
  @MinLength(6)
  senha: string;

  // PIN único de 6 dígitos — recupera qualquer um dos 3 níveis de senha.
  @IsString()
  @Matches(/^\d{6}$/, { message: 'O PIN deve ter exatamente 6 números.' })
  pin: string;
}
