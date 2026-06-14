import { Body, Controller, Post } from '@nestjs/common';
import { DevicesService } from './devices.service';

class ClaimDto {
  pairingCode!: string;
  name!: string;
  locationId!: string;
  playlistId?: string;
}

// /api/devices/* — JWT guard applies (plural path does not match /api/device/ passthrough).
@Controller('devices')
export class DevicesController {
  constructor(private devices: DevicesService) {}

  @Post('claim')
  claim(@Body() dto: ClaimDto) {
    return this.devices.claim(dto);
  }
}
