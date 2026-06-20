import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ContatosService } from './contatos.service';
import { CreateContatoDto, UpdateContatoDto } from './dto/contato.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class ContatosController {
  constructor(private contatos: ContatosService) {}

  // Contatos de um cliente
  @Get('clientes/:clienteId/contatos')
  list(@Param('clienteId') clienteId: string) {
    return this.contatos.listByCliente(clienteId);
  }

  @Roles('admin', 'operador')
  @Post('clientes/:clienteId/contatos')
  create(
    @Param('clienteId') clienteId: string,
    @Body() dto: CreateContatoDto,
  ) {
    return this.contatos.create(clienteId, dto);
  }

  // Operações diretas no contato
  @Roles('admin', 'operador')
  @Put('contatos/:id')
  update(@Param('id') id: string, @Body() dto: UpdateContatoDto) {
    return this.contatos.update(id, dto);
  }

  @Roles('admin')
  @Delete('contatos/:id')
  remove(@Param('id') id: string) {
    return this.contatos.remove(id);
  }
}
