import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrcamentosService } from './orcamentos.service';
import { CreateOrcamentoDto, UpdateOrcamentoDto } from './dto/orcamento.dto';
import {
  ListarOrcamentosDto,
  UpdateStatusDto,
} from './dto/listar-orcamentos.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('orcamentos')
export class OrcamentosController {
  constructor(private orcamentos: OrcamentosService) {}

  // Próximo número sugerido — vem antes de :id para não colidir
  @Get('proximo-numero')
  async proximoNumero() {
    return { numero: await this.orcamentos.proximoNumero() };
  }

  @Get()
  list(@Query() q: ListarOrcamentosDto) {
    return this.orcamentos.list(q);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.orcamentos.get(id);
  }

  @Post()
  create(@Body() dto: CreateOrcamentoDto, @CurrentUser() user: AuthUser) {
    return this.orcamentos.create(dto, user?.id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOrcamentoDto) {
    return this.orcamentos.update(id, dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.orcamentos.updateStatus(id, dto);
  }

  @Post(':id/enviar')
  enviar(@Param('id') id: string) {
    return this.orcamentos.enviar(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.orcamentos.remove(id);
  }
}
