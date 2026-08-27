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
import { UnauthorizedException } from '@nestjs/common';

interface AccessTokenPayload {
  userId: string;
  deviceId: string;
}

@WebSocketGateway({ cors: { origin: '*' } })
export class SyncGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    const authorizationToken = client.handshake.headers.authorization;
    const accessToken = authorizationToken?.split(' ')?.[1];

    if (!accessToken) return client.disconnect();

    try {
      const { userId, deviceId } =
        await this.jwtService.verifyAsync<AccessTokenPayload>(accessToken, {});
      client.data.userId = userId;
      client.data.deviceId = deviceId;
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    // Nothing to do here for room cleanup — why? (you already answered this above)
    // This hook is still useful for things like presence/logging later.
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
        update: data.update,
        documentId: data.documentId,
        createdAt: new Date(),
      },
    });

    // TODO 4: broadcast to everyone else in the room, excluding the sender
    client.to(data.documentId).emit('sync-update', data.update);
  }
}
