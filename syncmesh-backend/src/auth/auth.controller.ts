import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard } from './auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(
      loginDto.email!,
      loginDto.password!,
      loginDto.deviceName!,
    );
  }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return await this.authService.register(
      dto.email,
      dto.password,
      dto.firstName,
      dto.lastName,
    );
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    return await this.authService.refresh(
      dto.deviceId,
      dto.presentedRefreshToken,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('devices/:deviceId/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeDevice(
    @Req() req,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
  ) {
    // callingUserId comes from req.user — but what's the shape of req.user?
    // depends on what your JwtStrategy's validate() method returns — do you have
    // a JwtStrategy already from login? check it before writing this line.
    await this.authService.revokeDevice(req.user.userId, deviceId);
  }
}
