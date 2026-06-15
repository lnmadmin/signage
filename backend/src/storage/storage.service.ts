import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';
import { Client } from 'minio';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly client: Client;
  private readonly presignClient: Client;
  private readonly bucket: string;
  private readonly logger = new Logger(StorageService.name);

  constructor() {
    const port = Number(process.env.MINIO_PORT);
    const useSSL = process.env.MINIO_USE_SSL === 'true';
    const accessKey = process.env.MINIO_ACCESS_KEY!;
    const secretKey = process.env.MINIO_SECRET_KEY!;

    this.client = new Client({
      endPoint: process.env.MINIO_ENDPOINT!,
      port,
      useSSL,
      accessKey,
      secretKey,
    });

    this.bucket = process.env.MINIO_BUCKET!;

    // MINIO_PUBLIC_ENDPOINT overrides the host:port used in presigned download URLs.
    // Set to whatever address Android devices can reach MinIO on
    // (e.g. 10.0.2.2:9000 for the emulator, or your LAN IP for real sticks).
    // Must also specify MINIO_REGION when using this (default: us-east-1).
    // Leave unset to use the same endpoint as upload/delete.
    const pub = process.env.MINIO_PUBLIC_ENDPOINT?.trim();
    if (pub) {
      const colonIdx = pub.lastIndexOf(':');
      const pubHost = colonIdx > 0 ? pub.slice(0, colonIdx) : pub;
      const pubPort = colonIdx > 0 ? Number(pub.slice(colonIdx + 1)) : port;
      // Specifying region avoids a network roundtrip that discovers it;
      // without it the client tries (and fails) to connect to the public host from the server.
      const region = process.env.MINIO_REGION || 'us-east-1';
      this.presignClient = new Client({ endPoint: pubHost, port: pubPort, useSSL, accessKey, secretKey, region });
      this.logger.log(`Presigned URLs will use public endpoint: ${pubHost}:${pubPort} (region=${region})`);
    } else {
      this.presignClient = this.client;
    }
  }

  async onModuleInit() {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
      this.logger.log(`Created MinIO bucket: ${this.bucket}`);
    }
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    await this.client.putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': mimeType,
    });
  }

  async remove(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }

  presignedUrl(key: string, expirySeconds = 300): Promise<string> {
    return this.presignClient.presignedGetObject(this.bucket, key, expirySeconds);
  }

  sha256(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }
}
