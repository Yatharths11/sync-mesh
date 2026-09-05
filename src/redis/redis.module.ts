import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { redisPubProvider, redisSubProvider } from './redis.provider';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [redisPubProvider, redisSubProvider],
  exports: [redisPubProvider, redisSubProvider],
})
export class RedisModule {}
