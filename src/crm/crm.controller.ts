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
import { CrmService } from './crm.service';
import {
  CreateCrmContatoDto,
  ImportarContatosDto,
  UpdateCrmContatoDto,
} from './dto/crm-contato.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard)
@Controller('crm/contatos')
export class CrmController {
  constructor(private crm: CrmService) {}

  @Get()
  list(@Query() q: PaginationDto) {
    return this.crm.list(q);
  }

  @Roles('admin', 'operador')
  @Post()
  create(@Body() dto: CreateCrmContatoDto) {
    return this.crm.create(dto);
  }

  // Importação em lote (vCard .vcf ou lista estruturada vinda do CSV).
  @Roles('admin', 'operador')
  @Post('importar')
  importar(@Body() dto: ImportarContatosDto) {
    return this.crm.importar(dto);
  }

  @Roles('admin', 'operador')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCrmContatoDto) {
    return this.crm.update(id, dto);
  }

  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.crm.remove(id);
  }
}
