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
import { REDIS_PUB_CLIENT, REDIS_SUB_CLIENT } from 'src/redis/redis.provider';
import Redis from 'ioredis';
import { Doc, applyUpdate, encodeStateAsUpdate } from 'yjs';
import {
  DEVICE_REVOKED_CHANNEL,
  DOC_UPDATE_CHANNEL_PREFIX,
  DocUpdatePayload,
  RealtimeNotifierService,
} from './../realtime/realtime-notified.service';
import { UUID } from 'node:crypto';

interface AccessTokenPayload {
  userId: string;
  deviceId: string;
}

type PushPayload = [{ id: UUID; documentId: string; update: number }];

// Token bucket for per (userId, documentId) sync-update backpressure.
// KEYS[1] = bucket key, ARGV = [capacity, refillPerSec, nowMs, ttlSec]
// ponytail: fixed capacity/refill, no per-user tuning; revisit if abuse patterns vary by user
const RATE_LIMIT_SCRIPT = `
local tokens = tonumber(redis.call('HGET', KEYS[1], 'tokens'))
local ts = tonumber(redis.call('HGET', KEYS[1], 'ts'))
local capacity = tonumber(ARGV[1])
local refillPerSec = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])

if tokens == nil then
  tokens = capacity
  ts = now
end

tokens = math.min(capacity, tokens + ((now - ts) / 1000) * refillPerSec)

local allowed = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
end

redis.call('HSET', KEYS[1], 'tokens', tokens, 'ts', now)
redis.call('EXPIRE', KEYS[1], ttl)
return allowed
`;
export const RATE_LIMIT_CAPACITY = 20; // burst size, in ops
export const RATE_LIMIT_REFILL_PER_SEC = 10; // steady-state ops/sec
const RATE_LIMIT_KEY_TTL_SEC = 60;

// Compact ops into a snapshot roughly every N ops per document.
// ponytail: fixed cadence, no adaptive sizing
export const SNAPSHOT_EVERY_N_OPS = 50;
@WebSocketGateway({ cors: { origin: '*' } })
export class SyncGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  @WebSocketServer() server: Server;
  private deviceSocketMap = new Map<string, Socket>();

  constructor(
    @Inject(REDIS_SUB_CLIENT) private readonly subClient: Redis,
    @Inject(REDIS_PUB_CLIENT) private readonly pubClient: Redis,
    private readonly jwtService: JwtService,
    private prisma: PrismaService,
    private readonly realtimeNotifier: RealtimeNotifierService,
  ) {}

  async onModuleInit() {
    // TODO (Step 4):
    // 1. this.subClient.subscribe(DEVICE_REVOKED_CHANNEL)

    await this.subClient.subscribe(DEVICE_REVOKED_CHANNEL);
    console.log('Subscribed to channel:', DEVICE_REVOKED_CHANNEL);

    await this.subClient.psubscribe(`${DOC_UPDATE_CHANNEL_PREFIX}*`);
    console.log('Subscribed to pattern:', `${DOC_UPDATE_CHANNEL_PREFIX}*`);

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

    // Fan-out for document ops published by any gateway instance (including
    // this one) on doc:<documentId>. Every instance re-emits to its own
    // locally-connected sockets in that document's room, excluding the
    // socket that originated the op so it isn't echoed back to itself.
    this.subClient.on('pmessage', (_pattern, channel, message) => {
      if (channel.startsWith(DOC_UPDATE_CHANNEL_PREFIX)) {
        const documentId = channel.slice(DOC_UPDATE_CHANNEL_PREFIX.length);
        const { update, senderSocketId } = JSON.parse(
          message,
        ) as DocUpdatePayload;

        this.server
          .to(documentId)
          .except(senderSocketId)
          .emit('sync-update', update);
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

      const existingSocket = this.deviceSocketMap.get(deviceId);

      if (existingSocket) {
        existingSocket.disconnect(true);
      }

      this.deviceSocketMap.set(deviceId, client);
    } catch (error) {
      console.log('disconnecting', error);

      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    // Nothing to do here for room cleanup — why? (you already answered this above)
    // This hook is still useful for things like presence/logging later.

    const deviceId = client?.data?.deviceId;
    if (client === this.deviceSocketMap.get(deviceId)) {
      this.deviceSocketMap.delete(client.data.deviceId);
    }
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

    // Backpressure: a client sending ops faster than its token bucket
    // refills gets this op dropped instead of persisted + fanned out.
    const allowed = await this.checkRateLimit(userId, data.documentId);
    if (!allowed) return;

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
    // Published to Redis (doc:<documentId>) instead of an in-process
    // client.to(room).emit so other gateway instances see it too; this
    // instance's own sockets get it back via the pmessage handler above.
    await this.realtimeNotifier.notifyDocumentUpdate(data.documentId, {
      update: data.update,
      senderSocketId: client.id,
    });

    await this.maybeSnapshotDocument(data.documentId);
  }

  // Token bucket per (userId, documentId): true if this op may proceed.
  private async checkRateLimit(
    userId: string,
    documentId: string,
  ): Promise<boolean> {
    const key = `ratelimit:sync-update:${userId}:${documentId}`;
    const allowed = await this.pubClient.eval(
      RATE_LIMIT_SCRIPT,
      1,
      key,
      RATE_LIMIT_CAPACITY,
      RATE_LIMIT_REFILL_PER_SEC,
      Date.now(),
      RATE_LIMIT_KEY_TTL_SEC,
    );
    return allowed === 1;
  }

  // If a document has accumulated SNAPSHOT_EVERY_N_OPS ops since its last
  // snapshot, replay (prior snapshot + those ops) into a Yjs doc and store
  // the compacted result as the new snapshot. Never throws — snapshotting
  // is bookkeeping and must not break the real-time path.
  // ponytail: two instances can race past the threshold at once and both
  // write a snapshot; harmless (load always uses the latest by seq), add a
  // Redis lock here if duplicate snapshots become a volume problem.
  private async maybeSnapshotDocument(documentId: string): Promise<void> {
    try {
      const latestSnapshot = await this.prisma.documentSnapshot.findFirst({
        where: { documentId },
        orderBy: { seq: 'desc' },
        select: { stateBytes: true, seq: true },
      });
      const sinceSeq = latestSnapshot?.seq ?? BigInt(0);

      const opsSinceSnapshot = await this.prisma.documentOp.findMany({
        where: { documentId, seq: { gt: sinceSeq } },
        select: { update: true, seq: true },
        orderBy: { seq: 'asc' },
      });

      if (opsSinceSnapshot.length < SNAPSHOT_EVERY_N_OPS) return;

      const doc = new Doc();
      if (latestSnapshot) {
        applyUpdate(doc, new Uint8Array(latestSnapshot.stateBytes));
      }
      for (const op of opsSinceSnapshot) {
        applyUpdate(doc, new Uint8Array(op.update));
      }

      await this.prisma.documentSnapshot.create({
        data: {
          documentId,
          stateBytes: new Uint8Array(encodeStateAsUpdate(doc)),
          seq: opsSinceSnapshot[opsSinceSnapshot.length - 1].seq,
        },
      });
    } catch (error) {
      console.error('snapshot compaction failed for', documentId, error);
    }
  }

  @SubscribeMessage('pull')
  async handleUpdatePull(
    @MessageBody()
    data: {
      documentId: string;
      lastSeenSeq: number;
      limit: number;
    },
    @ConnectedSocket() client: Socket,
  ) {
    // If a snapshot exists ahead of what the client has already seen, it
    // replaces full history from seq 0: reply with it plus only the ops
    // after its seq, instead of every op for the document.
    const snapshot = await this.prisma.documentSnapshot.findFirst({
      where: { documentId: data.documentId, seq: { gt: data.lastSeenSeq } },
      select: { stateBytes: true, seq: true },
      orderBy: { seq: 'desc' },
    });
    const sinceSeq = snapshot?.seq ?? data.lastSeenSeq;

    const updates = await this.prisma.documentOp.findMany({
      where: {
        documentId: data.documentId,
        seq: {
          gt: sinceSeq,
        },
      },
      select: {
        id: true,
        update: true,
        seq: true,
      },
      orderBy: {
        seq: 'asc',
      },
      take: 501,
    });

    client.emit('pull', {
      snapshot,
      ops: updates.slice(0, 500),
      hasMore: updates.length > 500,
    });
  }

  @SubscribeMessage('push')
  async handleUpdatePush(
    @MessageBody()
    data: PushPayload,
    @ConnectedSocket() client: Socket,
  ) {
    // TODO 1: get userId off client.data (same as handleJoinRoom)
    const userId = client.data.userId;

    const documentIds = [...new Set(data.map((op) => op.documentId))];

    const authorizedDocs = await this.prisma.document.findMany({
      where: { id: { in: documentIds }, editors: { some: { id: userId } } },
      select: { id: true },
    });
    const authorizedIds = new Set(authorizedDocs.map((d) => d.id));
    const result: any = { success: [], fail: [] };
    const touchedDocumentIds = new Set<string>();

    await Promise.all(
      data.map(async (element) => {
        if (!authorizedIds.has(element.documentId)) {
          result.fail.push({
            id: element.id,
            error: 'UNAUTHORIZED',
          });

          return;
        }

        try {
          const documentOp = await this.prisma.documentOp.create({
            data: {
              id: element.id,
              update: new Uint8Array(element.update),
              documentId: element.documentId,
            },
          });
          touchedDocumentIds.add(element.documentId);

          result.success.push({
            id: documentOp.id,
            seq: documentOp.seq,
          });
        } catch (error) {
          console.log('logging the error:', error);

          if (error?.code === 'P2002') {
            result.success.push({
              id: element.id,
              seq: null,
              duplicate: true,
            });
          } else {
            result.fail.push({
              id: element.id,
              error: 'INVALID_PAYLOAD',
            });
          }
        }
      }),
    );

    await Promise.all(
      [...touchedDocumentIds].map((documentId) =>
        this.maybeSnapshotDocument(documentId),
      ),
    );

    client.emit('push', result);
  }
}
