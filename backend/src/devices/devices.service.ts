import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

// Unambiguous uppercase chars — no O/0/I/1 confusion on a TV screen
const PAIRING_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

interface ClaimDto {
  pairingCode: string;
  name: string;
  locationId: string;
  playlistId?: string;
}

@Injectable()
export class DevicesService {
  constructor(private prisma: PrismaService) {}

  async register() {
    const pairingCode = await this.uniquePairingCode();
    const registrationSecret = crypto.randomBytes(32).toString('hex');

    const device = await this.prisma.device.create({
      data: { pairingCode, registrationSecret },
    });

    return {
      deviceId: device.id,
      pairingCode: device.pairingCode,
      registrationSecret: device.registrationSecret,
    };
  }

  async getStatus(deviceId: string, secret: string | undefined) {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device || device.registrationSecret !== secret) {
      throw new UnauthorizedException('Invalid device ID or registration secret');
    }

    if (device.status === 'CLAIMED') {
      return { status: device.status, authToken: device.authToken };
    }
    return { status: device.status };
  }

  async claim(dto: ClaimDto) {
    const device = await this.prisma.device.findUnique({
      where: { pairingCode: dto.pairingCode },
    });

    if (!device || device.status !== 'PENDING') {
      throw new NotFoundException('No PENDING device found with that pairing code');
    }

    const location = await this.prisma.location.findUnique({
      where: { id: dto.locationId },
      select: { id: true },
    });
    if (!location) {
      throw new BadRequestException(`Location ${dto.locationId} not found`);
    }

    if (dto.playlistId) {
      const playlist = await this.prisma.playlist.findUnique({
        where: { id: dto.playlistId },
        select: { id: true },
      });
      if (!playlist) {
        throw new BadRequestException(`Playlist ${dto.playlistId} not found`);
      }
    }

    const authToken = crypto.randomBytes(32).toString('hex');

    const updated = await this.prisma.device.update({
      where: { id: device.id },
      data: {
        name: dto.name,
        locationId: dto.locationId,
        playlistId: dto.playlistId ?? null,
        status: 'CLAIMED',
        authToken,
        pairingCode: null,
      },
      include: {
        location: { select: { id: true, name: true } },
        playlist: { select: { id: true, name: true } },
      },
    });

    // Strip registrationSecret from the response
    const { registrationSecret: _secret, ...safeDevice } = updated;
    return safeDevice;
  }

  private async uniquePairingCode(): Promise<string> {
    for (;;) {
      const code = Array.from(
        { length: 6 },
        () => PAIRING_CHARS[Math.floor(Math.random() * PAIRING_CHARS.length)],
      ).join('');
      const conflict = await this.prisma.device.findUnique({
        where: { pairingCode: code },
        select: { id: true },
      });
      if (!conflict) return code;
    }
  }
}
