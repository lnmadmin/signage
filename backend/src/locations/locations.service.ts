import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateLocationDto {
  name: string;
  notes?: string;
  playlistId?: string;
}

interface UpdateLocationDto {
  name?: string;
  notes?: string | null;
  playlistId?: string | null;
}

@Injectable()
export class LocationsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.location.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        playlist: { select: { id: true, name: true } },
        _count: { select: { devices: true } },
      },
    });
  }

  async findOne(id: string) {
    const location = await this.prisma.location.findUnique({
      where: { id },
      include: {
        playlist: { select: { id: true, name: true } },
        devices: { select: { id: true, name: true, status: true, lastSeenAt: true } },
      },
    });
    if (!location) throw new NotFoundException('Location not found');
    return location;
  }

  async create(dto: CreateLocationDto) {
    if (dto.playlistId) await this.assertPlaylistExists(dto.playlistId);
    return this.prisma.location.create({ data: dto });
  }

  async update(id: string, dto: UpdateLocationDto) {
    await this.findOne(id);
    if (dto.playlistId) await this.assertPlaylistExists(dto.playlistId);
    return this.prisma.location.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const location = await this.findOne(id);
    if (location.devices.length > 0) {
      throw new ConflictException(
        `Cannot delete location with ${location.devices.length} device(s) assigned`,
      );
    }
    await this.prisma.location.delete({ where: { id } });
  }

  private async assertPlaylistExists(playlistId: string) {
    const exists = await this.prisma.playlist.findUnique({
      where: { id: playlistId },
      select: { id: true },
    });
    if (!exists) throw new BadRequestException(`Playlist ${playlistId} not found`);
  }
}
