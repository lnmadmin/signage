import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { DeviceWithLocation } from './device-auth.guard';

// Unambiguous uppercase chars — no O/0/I/1 confusion on a TV screen
const PAIRING_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

interface ClaimDto {
  pairingCode: string;
  name: string;
  locationId: string;
  playlistId?: string;
}

interface UpdateDeviceDto {
  name?: string;
  locationId?: string | null;
  playlistId?: string | null;
}

const DEVICE_SELECT = {
  id: true,
  name: true,
  status: true,
  lastSeenAt: true,
  currentItemId: true,
  locationId: true,
  location: { select: { id: true, name: true } },
  playlistId: true,
  playlist: { select: { id: true, name: true } },
  createdAt: true,
  updatedAt: true,
} as const;

interface HeartbeatDto {
  currentItemId?: string;
  freeBytes?: number;
}

@Injectable()
export class DevicesService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  // ── Pairing ────────────────────────────────────────────────────────────────

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

    const { registrationSecret: _secret, ...safeDevice } = updated;
    return safeDevice;
  }

  // ── Admin list / update / delete ───────────────────────────────────────────

  findAll() {
    return this.prisma.device.findMany({
      orderBy: { createdAt: 'desc' },
      select: DEVICE_SELECT,
    });
  }

  async update(id: string, dto: UpdateDeviceDto) {
    const exists = await this.prisma.device.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Device not found');
    return this.prisma.device.update({ where: { id }, data: dto, select: DEVICE_SELECT });
  }

  async remove(id: string) {
    const exists = await this.prisma.device.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Device not found');
    await this.prisma.device.delete({ where: { id } });
  }

  // ── Manifest ───────────────────────────────────────────────────────────────

  async manifest(device: DeviceWithLocation) {
    const playlistId =
      device.playlistId ?? device.location?.playlistId ?? null;

    if (!playlistId) {
      return { playlistId: null, updatedAt: null, items: [] };
    }

    const playlist = await this.prisma.playlist.findUnique({
      where: { id: playlistId },
      include: {
        items: {
          orderBy: { order: 'asc' },
          include: { mediaAsset: true },
        },
      },
    });

    if (!playlist) {
      return { playlistId: null, updatedAt: null, items: [] };
    }

    const items = await Promise.all(
      playlist.items.map(async (item) => ({
        itemId: item.id,
        type: item.mediaAsset.type,
        checksum: `sha256-${item.mediaAsset.checksum}`,
        durationSeconds:
          item.durationOverride ?? item.mediaAsset.durationSeconds ?? null,
        order: item.order,
        downloadUrl: await this.storage.presignedUrl(item.mediaAsset.storageKey),
      })),
    );

    return { playlistId: playlist.id, updatedAt: playlist.updatedAt, items };
  }

  // ── Heartbeat ──────────────────────────────────────────────────────────────

  async heartbeat(device: DeviceWithLocation, dto: HeartbeatDto) {
    await this.prisma.device.update({
      where: { id: device.id },
      data: {
        lastSeenAt: new Date(),
        ...(dto.currentItemId !== undefined && {
          currentItemId: dto.currentItemId,
        }),
      },
    });
    return { ok: true };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

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
