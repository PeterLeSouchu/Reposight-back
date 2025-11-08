import { Controller, Get, Logger } from '@nestjs/common';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  @Get('test')
  getTest() {
    this.logger.log('Route /test appelée');
    return { message: 'test ok' };
  }
}
