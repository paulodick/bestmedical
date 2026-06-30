import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { FollowUpsService } from './follow-ups.service';
import { CreateFollowUpDto, ListarFollowUpsDto } from './dto/follow-up.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('follow-ups')
export class FollowUpsController {
  constructor(private followUps: FollowUpsService) {}

  // GET /follow-ups?orcamentoId=... | ?propostaId=...
  @Get()
  list(@Query() q: ListarFollowUpsDto) {
    return this.followUps.list(q);
  }

  @Roles('admin', 'operador')
  @Post()
  create(@Body() dto: CreateFollowUpDto, @CurrentUser() user: AuthUser) {
    return this.followUps.create(dto, user);
  }
}
