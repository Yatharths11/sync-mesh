// auth.service.ts

import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // auth.service.ts

  async register(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ): Promise<{ userId: string }> {
    // 1. Check if a user with this email already exists
    //    - what happens if you skip this and rely purely on the DB unique constraint?
    //    - (think about it, but for now, do the explicit check — better error message)
    const existingUser = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // 2. Hash the password with argon2 (you already have the import)
    const hashedPassword = await argon2.hash(password);

    // 3. Create the User row via Prisma
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        firstName,
        lastName,
      },
    });

    // 4. Return just enough info to confirm success — NOT tokens, NOT the password hash
    return { userId: user.id };
  }

  async login(email: string, password: string, deviceName: string) {
    // 1. Find the user by email.
    //    - What do you do if no user exists? (generic error — see above)
    const user = await this.prisma.user.findFirst({
      where: {
        email,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // 2. Verify the password against user.passwordHash using argon2.verify()
    //    - What do you do if it fails? (same generic error, same message)

    if (!(await argon2.verify(user.passwordHash, password)))
      throw new UnauthorizedException('Invalid email or password');

    // 3. Generate a raw refresh token.
    //    - This should be a long, random, unguessable string — NOT a JWT.
    //    - Node's built-in `crypto` module has something for this. Look up:
    //      crypto.randomBytes(...)  — figure out how to turn bytes into a usable string.
    const refreshToken = randomBytes(32).toString('hex');

    // 4. Hash the raw refresh token with argon2 (same hashing tool as passwords).
    const refreshTokenHash = await argon2.hash(refreshToken);

    // 5. Create a new Device row: userId, deviceName, refreshTokenHash, lastLoginAt.
    const device = await this.prisma.device.create({
      data: {
        userId: user.id,
        deviceName,
        refreshTokenHash,
        lastLoginAt: new Date(),
      },
    });

    // 6. Sign an access token (JWT) using this.jwtService.sign(...).
    //    - Payload must include: userId, deviceId (the Device row's id you just created).
    //    - Why deviceId specifically? You answered this weeks ago — recall it if asked.
    const accessToken = await this.jwtService.signAsync({
      userId: user.id,
      deviceId: device.id,
    });

    // 7. Return { accessToken, refreshToken } — refreshToken is the RAW one from step 3,
    //    never the hash.
    return { accessToken, refreshToken };
  }
}
