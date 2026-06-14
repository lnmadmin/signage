import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

export type DeviceWithLocation = Prisma.DeviceGetPayload<{
  include: { location: { select: { id: true; playlistId: true } } };
}>;

export interface DeviceRequest extends Request {
  device: DeviceWithLocation;
}

@Injectable()
export class DeviceAuthGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<DeviceRequest>();
    const auth = req.headers['authorization'];
    const token =
      typeof auth === 'string' && auth.startsWith('Bearer ')
        ? auth.slice(7)
        : undefined;

    if (!token) throw new UnauthorizedException('Missing device auth token');

    const device = await this.prisma.device.findUnique({
      where: { authToken: token },
      include: { location: { select: { id: true, playlistId: true } } },
    });

    if (!device || device.status !== 'CLAIMED') {
      throw new UnauthorizedException('Invalid or inactive device token');
    }

    req.device = device;
    return true;
  }
}
