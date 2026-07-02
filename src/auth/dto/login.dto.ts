import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  // Login por usuário (nome+sobrenome juntos). Não diferencia maiúsc./minúsc.
  @IsString()
  @MinLength(3)
  usuario: string;

  @IsString()
  @MinLength(4)
  senha: string;
}
