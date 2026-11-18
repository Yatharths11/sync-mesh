import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, KeyboardAvoidingView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { io } from 'socket.io-client';
import * as Y from 'yjs';
import type { RootStackParamList } from '../../../App';
import { CollaborativeTextInput } from '../../components';
import { useAuthStore } from '../../store/store';
import { deleteOp, getPendingOps, insertOp } from '../../db/pending-ops';
import { getLastSeenSeq, setLastSeenSeq } from '../../db/sync-state';
import { useTheme } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Editor'>;

type PullResult = {
  snapshot: { stateBytes: unknown; seq: number } | null;
  ops: { update: unknown; seq: number }[];
  hasMore: boolean;
};

type PushResult = {
  success: { id: string }[];
};

type PresenceUser = { userId: string; firstName: string; lastName: string | null };
type PresencePayload = { documentId: string; users: PresenceUser[] };

// Stable-per-user color pick from theme.avatarPalette -- simple char-code hash
// so the same userId always lands on the same color across re-renders.
function avatarColorFor(userId: string, palette: readonly string[]): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash += userId.charCodeAt(i);
  return palette[hash % palette.length];
}

function initialsFor(user: PresenceUser): string {
  return `${user.firstName[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase();
}

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
  const { colors, spacing } = useTheme();
  const styles = createStyles(colors, spacing);
  const accessToken = useAuthStore(state => state.accessToken)!;
  const ydoc = useMemo(() => new Y.Doc(), [documentId]);
  const isDrainingRef = useRef(false);
  const [presentUsers, setPresentUsers] = useState<PresenceUser[]>([]);
  const [connected, setConnected] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const drainRef = useRef<() => void>(() => {});

  const handleSave = () => {
    drainRef.current();
    navigation.goBack();
  };

  useEffect(() => {
    navigation.setOptions({
      title: 'Document',
      headerRight: () => (
        <TouchableOpacity onPress={handleSave} activeOpacity={0.7} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useEffect(() => () => ydoc.destroy(), [ydoc]);

  useEffect(() => {
    const socket = io('http://localhost:3000', {
      transports: ['websocket'],
      extraHeaders: { Authorization: `Bearer ${accessToken}` },
    });

    const refreshPendingCount = () =>
      setPendingCount(getPendingOps(documentId).length);
    refreshPendingCount();

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
        refreshPendingCount();
      });
    };
    drainRef.current = drainPendingOps;

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
        refreshPendingCount();

        if (result.hasMore) {
          pullAndDrain(seq);
        } else {
          drainPendingOps();
        }
      });
    };

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join-room', { documentId });
      pullAndDrain();
    });
    socket.on('disconnect', () => setConnected(false));

    const handlePresence = (payload: PresencePayload) => {
      if (payload.documentId !== documentId) return;
      setPresentUsers(payload.users);
    };
    socket.on('presence', handlePresence);

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
      refreshPendingCount();
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
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.statusBar}>
        <View style={styles.avatarRow}>
          {presentUsers.map(user => (
            <View
              key={user.userId}
              style={[
                styles.avatar,
                { backgroundColor: avatarColorFor(user.userId, colors.avatarPalette) },
              ]}
            >
              <Text style={styles.avatarText}>{initialsFor(user)}</Text>
            </View>
          ))}
        </View>
        <View style={styles.syncStatus}>
          {pendingCount > 0 && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>{pendingCount}</Text>
            </View>
          )}
          <View
            style={[
              styles.statusDot,
              { backgroundColor: connected ? colors.success : colors.danger },
            ]}
          />
          <Text style={styles.statusLabel}>
            {connected ? 'Connected' : 'Offline'}
          </Text>
        </View>
        </View>
        <CollaborativeTextInput ydoc={ydoc} props={{ style: { flex: 1 } }} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  spacing: ReturnType<typeof useTheme>['spacing'],
) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: spacing.md,
    },
    statusBar: {
      height: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginBottom: spacing.sm,
    },
    avatarRow: {
      flexDirection: 'row',
    },
    avatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.xs,
    },
    avatarText: {
      color: colors.accentText,
      fontSize: 12,
      fontWeight: '600',
    },
    syncStatus: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    pendingBadge: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.border,
      marginRight: spacing.xs,
    },
    pendingBadgeText: {
      color: colors.textPrimary,
      fontSize: 11,
      fontWeight: '600',
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: spacing.xs,
    },
    statusLabel: {
      color: colors.textSecondary,
      fontSize: 12,
    },
    saveButton: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    saveButtonText: {
      color: colors.accent,
      fontSize: 16,
      fontWeight: '600',
    },
  });
}
