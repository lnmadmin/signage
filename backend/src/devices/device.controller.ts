import { Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { DevicesService } from './devices.service';

// Routes under /api/device/* are passed through by JwtAuthGuard automatically.
@Controller('device')
export class DeviceController {
  constructor(private devices: DevicesService) {}

  @Post('register')
  register() {
    return this.devices.register();
  }

  @Get('status')
  getStatus(
    @Query('deviceId') deviceId: string,
    @Headers('x-registration-secret') secret: string | undefined,
  ) {
    return this.devices.getStatus(deviceId, secret);
  }
}
