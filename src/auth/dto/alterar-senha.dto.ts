import { IsEmail, IsString, MinLength } from 'class-validator';

// Usado na tela de login (usuário NÃO autenticado): exige e-mail + senha atual
// para autorizar a troca, evitando que terceiros alterem a senha de outra conta.
export class AlterarSenhaDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(4)
  senhaAtual: string;

  @IsString()
  @MinLength(6, { message: 'A nova senha deve ter ao menos 6 caracteres.' })
  novaSenha: string;
}
