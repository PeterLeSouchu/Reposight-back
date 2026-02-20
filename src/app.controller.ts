import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('App')
@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  @Get('test')
  @ApiOperation({ summary: 'Endpoint de test' })
  @ApiResponse({ status: 200, description: 'Test réussi' })
  getTest() {
    this.logger.log('Route /test appelée');
    return { message: 'test ok' };
  }
}
