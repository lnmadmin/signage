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
  Put,
} from '@nestjs/common';
import { PlaylistsService } from './playlists.service';

class CreatePlaylistDto {
  name!: string;
}

class UpdatePlaylistDto {
  name!: string;
}

class PlaylistItemDto {
  mediaAssetId!: string;
  order!: number;
  durationOverride?: number | null;
}

@Controller('playlists')
export class PlaylistsController {
  constructor(private playlists: PlaylistsService) {}

  @Get()
  findAll() {
    return this.playlists.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.playlists.findOne(id);
  }

  @Post()
  create(@Body() dto: CreatePlaylistDto) {
    return this.playlists.create(dto.name);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePlaylistDto) {
    return this.playlists.update(id, dto.name);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.playlists.remove(id);
  }

  @Put(':id/items')
  replaceItems(@Param('id') id: string, @Body() items: PlaylistItemDto[]) {
    return this.playlists.replaceItems(id, items);
  }
}
