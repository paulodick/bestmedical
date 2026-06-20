import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CepService } from './cep.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('cep')
export class CepController {
  constructor(private cep: CepService) {}

  @Get(':cep')
  consultar(@Param('cep') cep: string) {
    return this.cep.consultar(cep);
  }
}
