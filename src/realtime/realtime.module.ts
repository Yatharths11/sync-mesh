import { Module } from '@nestjs/common';
import { RealtimeNotifierService } from './realtime-notified.service';

@Module({
  providers: [RealtimeNotifierService],
  exports: [RealtimeNotifierService],
})
export class RealtimeNotifierModule {}
