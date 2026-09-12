import Redis from 'ioredis';
import { Provider } from '@nestjs/common';

export const REDIS_PUB_CLIENT = 'REDIS_PUB_CLIENT';
export const REDIS_SUB_CLIENT = 'REDIS_SUB_CLIENT';

export const redisPubProvider: Provider = {
  provide: REDIS_PUB_CLIENT,
  useFactory: () => {
    return new Redis({
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    });
  },
};

export const redisSubProvider: Provider = {
  provide: REDIS_SUB_CLIENT,
  useFactory: () => {
    // TODO: same connection details as pub client — this is a
    // SEPARATE instance, not a shared one. Why? (you already answered this)
    return new Redis({
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    });
  },
};
