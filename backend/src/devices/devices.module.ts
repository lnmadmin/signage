import { Module } from '@nestjs/common';
import { DeviceAuthGuard } from './device-auth.guard';
import { DeviceController } from './device.controller';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';

@Module({
  controllers: [DeviceController, DevicesController],
  providers: [DevicesService, DeviceAuthGuard],
})
export class DevicesModule {}
