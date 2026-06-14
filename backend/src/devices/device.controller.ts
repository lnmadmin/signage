import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentDevice } from './current-device.decorator';
import { DeviceAuthGuard, DeviceWithLocation } from './device-auth.guard';
import { DevicesService } from './devices.service';

// All routes under /api/device/* are passed through by JwtAuthGuard.
// manifest and heartbeat additionally require the device's own authToken.
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

  @Get('manifest')
  @UseGuards(DeviceAuthGuard)
  manifest(@CurrentDevice() device: DeviceWithLocation) {
    return this.devices.manifest(device);
  }

  @Post('heartbeat')
  @UseGuards(DeviceAuthGuard)
  @HttpCode(HttpStatus.OK)
  heartbeat(
    @CurrentDevice() device: DeviceWithLocation,
    @Body() body: { currentItemId?: string; freeBytes?: number },
  ) {
    return this.devices.heartbeat(device, body);
  }
}
