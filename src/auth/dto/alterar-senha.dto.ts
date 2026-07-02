import { IsString, MinLength } from 'class-validator';

// Usado na tela de login (usuário NÃO autenticado): exige usuário + senha atual
// para autorizar a troca, evitando que terceiros alterem a senha de outra conta.
export class AlterarSenhaDto {
  @IsString()
  @MinLength(3)
  usuario: string;

  @IsString()
  @MinLength(4)
  senhaAtual: string;

  @IsString()
  @MinLength(6, { message: 'A nova senha deve ter ao menos 6 caracteres.' })
  novaSenha: string;
}
