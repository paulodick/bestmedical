import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { CreateClienteDto, UpdateClienteDto } from './dto/cliente.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard)
@Controller('clientes')
export class ClientesController {
  constructor(private clientes: ClientesService) {}

  @Get()
  list(@Query() q: PaginationDto) {
    return this.clientes.list(q);
  }

  // Autocompletar por CNPJ na tela de Novo Orçamento.
  // Recebe o CNPJ por query (?cnpj=...) pois o valor contém “/”.
  // Vem antes de :id para não colidir com a rota de detalhe.
  @Get('por-cnpj')
  buscarPorCnpj(@Query('cnpj') cnpj: string) {
    return this.clientes.buscarPorCnpj(cnpj);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.clientes.get(id);
  }

  @Roles('admin', 'operador')
  @Post()
  create(@Body() dto: CreateClienteDto) {
    return this.clientes.create(dto);
  }

  @Roles('admin', 'operador')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateClienteDto) {
    return this.clientes.update(id, dto);
  }

  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.clientes.remove(id);
  }
}
