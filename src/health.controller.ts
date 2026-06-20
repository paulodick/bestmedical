import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/public.decorator';

// Health check público (usado pelo Render)
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return { status: 'ok', service: 'bestmedical-api', time: new Date().toISOString() };
  }
}
