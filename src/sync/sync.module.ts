import { Module } from '@nestjs/common';
import { SyncGateway } from './sync.gateway';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [AuthModule, PrismaModule],
  providers: [SyncGateway],
})
export class SyncModule {}
