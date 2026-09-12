import { Module } from '@nestjs/common';
import { SyncGateway } from './sync.gateway';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [AuthModule, PrismaModule, JwtModule],
  providers: [SyncGateway],
})
export class SyncModule {}
