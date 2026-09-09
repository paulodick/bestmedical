import { IsString, Matches } from 'class-validator';

export class RecuperarDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'PIN inválido.' })
  pin: string;
}
