import { Module } from '@nestjs/common';
import { SyncGateway } from './sync.gateway';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { RealtimeNotifierModule } from '../realtime/realtime.module';

@Module({
  imports: [AuthModule, PrismaModule, JwtModule, RealtimeNotifierModule],
  providers: [SyncGateway],
})
export class SyncModule {}
