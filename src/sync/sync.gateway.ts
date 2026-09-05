import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'prisma/prisma.service';
import { Inject, OnModuleInit } from '@nestjs/common';
import { REDIS_SUB_CLIENT } from 'src/redis/redis.provider';
import Redis from 'ioredis';
import { DEVICE_REVOKED_CHANNEL } from './../realtime/realtime-notified.service';

interface AccessTokenPayload {
  userId: string;
  deviceId: string;
}

@WebSocketGateway({ cors: { origin: '*' } })
export class SyncGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  @WebSocketServer() server: Server;
  private deviceSocketMap = new Map<string, Socket>();

  constructor(
    @Inject(REDIS_SUB_CLIENT) private readonly subClient: Redis,
    private readonly jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async onModuleInit() {
    // TODO (Step 4):
    // 1. this.subClient.subscribe(DEVICE_REVOKED_CHANNEL)

    await this.subClient.subscribe(DEVICE_REVOKED_CHANNEL);
    console.log('Subscribed to channel:', DEVICE_REVOKED_CHANNEL);

    this.subClient.on('error', (err) =>
      console.error('Redis sub client error:', err),
    );

    // 2. this.subClient.on('message', (channel, message) => { ... })
    //    Inside the callback (Step 5):
    //    - message IS the deviceId (you published a raw string, remember)
    //    - look it up in this.deviceSocketMap
    //    - if found, disconnect it
    this.subClient.on('message', (channel, message) => {
      const socket = this.deviceSocketMap.get(message);
      if (socket) {
        socket.disconnect(true);
      }
    });
  }

  async handleConnection(client: Socket) {
    const authorizationToken = client.handshake.headers.authorization;
    const accessToken = authorizationToken?.split(' ')?.[1];

    if (!accessToken) return client.disconnect();

    try {
      const result = await this.jwtService.verifyAsync<AccessTokenPayload>(
        accessToken,
        {
          secret: process.env.JWT_SECRET,
        },
      );

      const { userId, deviceId } = result;
      client.data.userId = userId;
      client.data.deviceId = deviceId;
      this.deviceSocketMap.set(deviceId, client);
    } catch (error) {
      console.log('disconnecting', error);

      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    // Nothing to do here for room cleanup — why? (you already answered this above)
    // This hook is still useful for things like presence/logging later.
    this.deviceSocketMap.delete(client.data.deviceId);
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @MessageBody() data: { documentId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId;
    if (!userId) return client.disconnect();

    const document = await this.prisma.document.findFirst({
      where: { id: data.documentId, editors: { some: { id: userId } } },
    });
    if (!document) {
      client.emit('unauthorized', 'You are not an editor of this doucmnet');

      return;
    }

    await client.join(data.documentId);
  }

  @SubscribeMessage('sync-update')
  async handleSyncUpdate(
    @MessageBody() data: { documentId: string; update: number[] }, // Yjs update bytes, array-of-numbers over the wire
    @ConnectedSocket() client: Socket,
  ) {
    // TODO 1: get userId off client.data (same as handleJoinRoom)
    const userId = client.data.userId;

    // TODO 2: re-verify this user still has editor access to data.documentId
    //         (yes, again — think about why a prior join-room check isn't enough
    //         on its own; we'll discuss after you attempt this)
    const document = await this.prisma.document.findFirst({
      where: { id: data.documentId, editors: { some: { id: userId } } },
    });

    if (!document) {
      client.emit('unauthorized', 'You do not have access to this document');
      return;
    }

    // TODO 3: persist the update — insert a new DocumentOp row with the raw bytes
    //         (you'll need to know DocumentOp's exact field names — check schema.prisma)
    const documentOp = await this.prisma.documentOp.create({
      data: {
        update: new Uint8Array(data.update),
        documentId: data.documentId,
        createdAt: new Date(),
      },
    });

    // TODO 4: broadcast to everyone else in the room, excluding the sender
    client.to(data.documentId).emit('sync-update', data.update);
  }
}
