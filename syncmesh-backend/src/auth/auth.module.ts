import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RealtimeNotifierModule } from './../realtime/realtime.module';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        expiresIn: config.getOrThrow<string>(
          'JWT_ACCESS_EXPIRY',
        ) as `${number}${'s' | 'm' | 'h' | 'd'}`,
      }),
    }),
    RealtimeNotifierModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RealtimeNotifierModule],
})
export class AuthModule {}
