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
import { LocationsService } from './locations.service';

class CreateLocationDto {
  name!: string;
  notes?: string;
  playlistId?: string;
}

class UpdateLocationDto {
  name?: string;
  notes?: string | null;
  playlistId?: string | null;
}

@Controller('locations')
export class LocationsController {
  constructor(private locations: LocationsService) {}

  @Get()
  findAll() {
    return this.locations.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.locations.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateLocationDto) {
    return this.locations.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLocationDto) {
    return this.locations.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.locations.remove(id);
  }
}
