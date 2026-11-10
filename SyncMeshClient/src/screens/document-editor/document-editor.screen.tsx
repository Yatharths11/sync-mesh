import { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { io } from 'socket.io-client';
import * as Y from 'yjs';
import type { RootStackParamList } from '../../../App';
import { CollaborativeTextInput } from '../../components';
import { useAuthStore } from '../../store/store';
import { deleteOp, getPendingOps, insertOp } from '../../db/pending-ops';
import { getLastSeenSeq, setLastSeenSeq } from '../../db/sync-state';

type Props = NativeStackScreenProps<RootStackParamList, 'Editor'>;

type PullResult = {
  snapshot: { stateBytes: unknown; seq: number } | null;
  ops: { update: unknown; seq: number }[];
  hasMore: boolean;
};

type PushResult = {
  success: { id: string }[];
};

// Bytes fields (snapshot/op update) come back over the socket as whatever
// shape socket.io reconstructs binary data into (ArrayBuffer, a plain
// number[], or a JSON-serialized Buffer) -- normalize to a Uint8Array.
function toUint8Array(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (value && typeof value === 'object' && 'data' in (value as object)) {
    return Uint8Array.from((value as { data: number[] }).data);
  }
  return Uint8Array.from(value as number[]);
}

export default function EditorScreen({ route, navigation }: Readonly<Props>) {
  const { documentId } = route.params;
  const accessToken = useAuthStore(state => state.accessToken)!;
  const ydoc = useMemo(() => new Y.Doc(), [documentId]);
  const isDrainingRef = useRef(false);

  useEffect(() => {
    navigation.setOptions({ title: 'Document' });
  }, [navigation]);

  useEffect(() => () => ydoc.destroy(), [ydoc]);

  useEffect(() => {
    const socket = io('http://localhost:3000', {
      transports: ['websocket'],
      extraHeaders: { Authorization: `Bearer ${accessToken}` },
    });

    // Pushes everything queued in pending_ops for this document. Idempotent
    // on the server (a duplicate id comes back as success), so safe to call
    // repeatedly; ops the server rejects are left queued for the next pass.
    // ponytail: no retry backoff/limit on permanently-failing ops (e.g.
    // revoked access) -- add one if the queue stops draining in practice.
    const drainPendingOps = () => {
      if (isDrainingRef.current) return;
      const pending = getPendingOps(documentId);
      if (pending.length === 0) return;

      isDrainingRef.current = true;
      socket.emit(
        'push',
        pending.map(op => ({
          id: op.opId,
          documentId,
          update: Array.from(op.content),
        })),
      );
      socket.once('push', (result: PushResult) => {
        const pushedIds = new Set(result.success.map(item => item.id));
        for (const op of pending) {
          if (pushedIds.has(op.opId)) deleteOp(op.id);
        }
        isDrainingRef.current = false;
      });
    };

    // Catches this device up on ops it missed while offline, paginated by
    // server sequence number, then drains anything still queued locally.
    const pullAndDrain = (lastSeenSeq = getLastSeenSeq(documentId)) => {
      socket.emit('pull', { documentId, lastSeenSeq, limit: 500 });
      socket.once('pull', (result: PullResult) => {
        let seq = lastSeenSeq;
        if (result.snapshot) {
          Y.applyUpdate(ydoc, toUint8Array(result.snapshot.stateBytes), 'remote');
          seq = Number(result.snapshot.seq);
        }
        for (const op of result.ops) {
          Y.applyUpdate(ydoc, toUint8Array(op.update), 'remote');
          seq = Number(op.seq);
        }
        setLastSeenSeq(documentId, seq);

        if (result.hasMore) {
          pullAndDrain(seq);
        } else {
          drainPendingOps();
        }
      });
    };

    socket.on('connect', () => {
      socket.emit('join-room', { documentId });
      pullAndDrain();
    });

    const handleRemoteUpdate = (update: number[]) => {
      Y.applyUpdate(ydoc, new Uint8Array(update), 'remote');
    };
    socket.on('sync-update', handleRemoteUpdate);

    const handleLocalUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === 'remote') return;

      // Durable outbox: recorded before anything goes over the wire, so an
      // offline edit (or one whose live emit never lands) still reaches the
      // server once connectivity returns.
      insertOp(documentId, update);
      socket.emit('sync-update', { documentId, update: Array.from(update) });
      if (socket.connected) drainPendingOps();
    };
    ydoc.on('update', handleLocalUpdate);

    return () => {
      ydoc.off('update', handleLocalUpdate);
      socket.disconnect();
    };
  }, [documentId, accessToken, ydoc]);

  return (
    <View style={styles.container}>
      <CollaborativeTextInput ydoc={ydoc} props={{ style: { flex: 1 } }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
});
