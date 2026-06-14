import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface ItemInput {
  mediaAssetId: string;
  order: number;
  durationOverride?: number | null;
}

@Injectable()
export class PlaylistsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.playlist.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { items: true } } },
    });
  }

  async findOne(id: string) {
    const playlist = await this.prisma.playlist.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { order: 'asc' },
          include: { mediaAsset: true },
        },
      },
    });
    if (!playlist) throw new NotFoundException('Playlist not found');
    return playlist;
  }

  create(name: string) {
    return this.prisma.playlist.create({ data: { name } });
  }

  async update(id: string, name: string) {
    await this.findOne(id);
    return this.prisma.playlist.update({ where: { id }, data: { name } });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.playlist.delete({ where: { id } });
  }

  async replaceItems(id: string, items: ItemInput[]) {
    await this.findOne(id);

    if (items.length > 0) {
      const uniqueAssetIds = [...new Set(items.map((i) => i.mediaAssetId))];
      const found = await this.prisma.mediaAsset.findMany({
        where: { id: { in: uniqueAssetIds } },
        select: { id: true },
      });
      if (found.length !== uniqueAssetIds.length) {
        const missing = uniqueAssetIds.filter(
          (aid) => !found.some((f) => f.id === aid),
        );
        throw new BadRequestException(
          `Unknown mediaAssetId(s): ${missing.join(', ')}`,
        );
      }
    }

    await this.prisma.$transaction([
      this.prisma.playlistItem.deleteMany({ where: { playlistId: id } }),
      this.prisma.playlistItem.createMany({
        data: items.map((item) => ({ playlistId: id, ...item })),
      }),
    ]);

    return this.findOne(id);
  }
}
