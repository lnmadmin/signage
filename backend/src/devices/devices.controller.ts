import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { DevicesService } from './devices.service';

class ClaimDto {
  pairingCode!: string;
  name!: string;
  locationId!: string;
  playlistId?: string;
  orientation?: 'LANDSCAPE' | 'PORTRAIT';
}

class UpdateDeviceDto {
  name?: string;
  locationId?: string | null;
  playlistId?: string | null;
  orientation?: 'LANDSCAPE' | 'PORTRAIT';
}

// /api/devices/* — JWT guard applies (plural path does not match /api/device/ passthrough).
@Controller('devices')
export class DevicesController {
  constructor(private devices: DevicesService) {}

  @Get()
  findAll() {
    return this.devices.findAll();
  }

  @Post('claim')
  claim(@Body() dto: ClaimDto) {
    return this.devices.claim(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDeviceDto) {
    return this.devices.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.devices.remove(id);
  }
}
