import { IsString, IsUUID } from 'class-validator';

export class RefreshDto {
  @IsUUID()
  deviceId!: string;

  @IsString()
  presentedRefreshToken!: string;
}
