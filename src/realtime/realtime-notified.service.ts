import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_PUB_CLIENT } from 'src/redis/redis.provider';

export const DEVICE_REVOKED_CHANNEL = 'device-revoked';

@Injectable()
export class RealtimeNotifierService {
  constructor(@Inject(REDIS_PUB_CLIENT) private readonly pubClient: Redis) {}

  async notifyDeviceRevoked(deviceId: string): Promise<void> {
    console.log('publishing:', deviceId);
    await this.pubClient.publish(DEVICE_REVOKED_CHANNEL, deviceId);
  }
}
