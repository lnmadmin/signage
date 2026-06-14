import { Module } from '@nestjs/common';
import { DeviceController } from './device.controller';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';

@Module({
  controllers: [DeviceController, DevicesController],
  providers: [DevicesService],
})
export class DevicesModule {}
