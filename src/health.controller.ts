import { Controller, Get } from '@nestjs/common';

// Health check público (usado pelo Render)
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', service: 'bestmedical-api', time: new Date().toISOString() };
  }
}
