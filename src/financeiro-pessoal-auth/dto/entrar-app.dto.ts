import { IsString, MinLength } from 'class-validator';

export class EntrarAppDto {
  @IsString()
  @MinLength(1)
  usuario: string;

  @IsString()
  @MinLength(1)
  senha: string;
}
