import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_PUB_CLIENT } from 'src/redis/redis.provider';

export const DEVICE_REVOKED_CHANNEL = 'device-revoked';
export const DOC_UPDATE_CHANNEL_PREFIX = 'doc:';

export interface DocUpdatePayload {
  update: number[];
  senderSocketId: string;
}

@Injectable()
export class RealtimeNotifierService {
  constructor(@Inject(REDIS_PUB_CLIENT) private readonly pubClient: Redis) {}

  async notifyDeviceRevoked(deviceId: string): Promise<void> {
    console.log('publishing:', deviceId);
    await this.pubClient.publish(DEVICE_REVOKED_CHANNEL, deviceId);
  }

  async notifyDocumentUpdate(
    documentId: string,
    payload: DocUpdatePayload,
  ): Promise<void> {
    await this.pubClient.publish(
      `${DOC_UPDATE_CHANNEL_PREFIX}${documentId}`,
      JSON.stringify(payload),
    );
  }
}
