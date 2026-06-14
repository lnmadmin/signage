import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MediaType } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

function inferMediaType(mimeType: string): MediaType {
  if (mimeType.startsWith('image/')) return MediaType.IMAGE;
  if (mimeType.startsWith('video/')) return MediaType.VIDEO;
  return MediaType.WEB;
}

@Injectable()
export class MediaService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async upload(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');

    const key = crypto.randomUUID();
    const checksum = this.storage.sha256(file.buffer);
    const type = inferMediaType(file.mimetype);

    await this.storage.upload(key, file.buffer, file.mimetype);

    return this.prisma.mediaAsset.create({
      data: {
        type,
        storageKey: key,
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        checksum,
      },
    });
  }

  findAll() {
    return this.prisma.mediaAsset.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async remove(id: string): Promise<void> {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('Media asset not found');

    await this.storage.remove(asset.storageKey);
    await this.prisma.mediaAsset.delete({ where: { id } });
  }
}
