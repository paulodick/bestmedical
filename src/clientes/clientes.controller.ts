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

@UseGuards(JwtAuthGuard)
@Controller('clientes')
export class ClientesController {
  constructor(private clientes: ClientesService) {}

  @Get()
  list(@Query() q: PaginationDto) {
    return this.clientes.list(q);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.clientes.get(id);
  }

  @Post()
  create(@Body() dto: CreateClienteDto) {
    return this.clientes.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateClienteDto) {
    return this.clientes.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.clientes.remove(id);
  }
}
