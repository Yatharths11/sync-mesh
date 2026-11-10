#!/usr/bin/env node
/**
 * Load test for the sync-update WebSocket path (SyncGateway).
 *
 * Spins up N fake clients (socket.io-client), has them all join the same
 * document room, then has each client emit sync-update ops at a fixed rate.
 * Latency is measured receiver-side: every op carries a send timestamp, and
 * every OTHER client in the room that receives it records (now - sentAt).
 * (The sender itself never gets its own op echoed back — see
 * SyncGateway's `.except(senderSocketId)` — so sender-side round-trip isn't
 * a thing here; this measures real fan-out latency between two clients.)
 *
 * Setup uses the real REST auth + documents endpoints, so the server's
 * actual authorization checks (join-room / sync-update) run for real.
 *
 * Note: all simulated clients log in as devices of ONE user (so they're all
 * editors of the test document), and SyncGateway's token-bucket rate limit
 * is keyed by (userId, documentId) — so it's shared across every client
 * here, not per-device. At high CLIENTS * RATE this script will legitimately
 * get ops silently dropped by that shared bucket; that's real server
 * behavior, not a bug in the script.
 *
 * Usage:
 *   node scripts/load-test-sync.js
 *
 * Config (env vars, all optional):
 *   BASE_URL        default http://localhost:3000
 *   CLIENTS         number of simulated clients          default 20
 *   RATE            ops/sec, per client                  default 5
 *   DURATION_SEC    how long to send ops                  default 15
 *   PAYLOAD_BYTES   size of each fake op payload          default 64
 */

const { io } = require('socket.io-client');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const NUM_CLIENTS = parseInt(process.env.CLIENTS || '20', 10);
const RATE_PER_CLIENT = parseFloat(process.env.RATE || '5');
const DURATION_SEC = parseFloat(process.env.DURATION_SEC || '15');
const PAYLOAD_BYTES = parseInt(process.env.PAYLOAD_BYTES || '64', 10);

const JOIN_GRACE_MS = 500;
const DRAIN_GRACE_MS = 2000;

async function httpJson(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// Encodes a send timestamp (ms since epoch, as a float64) into a byte array
// of the requested size. The server treats `update` as opaque bytes, so this
// stands in for a real Yjs update without needing one.
function makePayload(sentAt) {
  const buf = Buffer.alloc(Math.max(PAYLOAD_BYTES, 8));
  buf.writeDoubleBE(sentAt, 0);
  return Array.from(buf);
}

function readSentAt(update) {
  return Buffer.from(update).readDoubleBE(0);
}

async function setup() {
  const email = `loadtest-${Date.now()}@example.com`;
  const password = 'loadtest-password-123';

  await httpJson('/auth/register', {
    email,
    password,
    firstName: 'Load',
    lastName: 'Test',
  });

  const logins = [];
  for (let i = 0; i < NUM_CLIENTS; i++) {
    logins.push(
      await httpJson('/auth/login', {
        email,
        password,
        deviceName: `load-test-client-${i}`,
      }),
    );
  }

  const document = await fetch(`${BASE_URL}/documents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${logins[0].accessToken}`,
    },
    body: JSON.stringify({
      name: `load-test-${Date.now()}`,
      description: 'load test document',
    }),
  }).then((res) => res.json());

  return { logins, documentId: document.id };
}

function connectClient(accessToken, documentId, stats) {
  return new Promise((resolve, reject) => {
    const socket = io(BASE_URL, {
      transports: ['websocket'],
      extraHeaders: { Authorization: `Bearer ${accessToken}` },
      reconnection: false,
    });

    socket.on('connect_error', (err) => {
      stats.errors++;
      reject(err);
    });

    socket.on('unauthorized', () => {
      stats.errors++;
    });

    socket.on('sync-update', (update) => {
      const sentAt = readSentAt(update);
      stats.latencies.push(Date.now() - sentAt);
    });

    socket.on('disconnect', () => {
      stats.disconnects++;
    });

    socket.on('connect', () => {
      socket.emit('join-room', { documentId });
      resolve(socket);
    });
  });
}

function percentile(sorted, p) {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx];
}

async function main() {
  console.log(
    `Setting up: ${NUM_CLIENTS} clients, ${RATE_PER_CLIENT} ops/sec each, ${DURATION_SEC}s duration`,
  );

  const { logins, documentId } = await setup();
  console.log(`Document ${documentId} ready with ${logins.length} devices`);

  const stats = { latencies: [], errors: 0, disconnects: 0 };
  const sockets = await Promise.all(
    logins.map((l) => connectClient(l.accessToken, documentId, stats)),
  );
  await new Promise((r) => setTimeout(r, JOIN_GRACE_MS));
  console.log('All clients joined room, starting load...');

  let opsSent = 0;
  const intervalMs = 1000 / RATE_PER_CLIENT;
  const timers = sockets.map((socket) =>
    setInterval(() => {
      socket.emit('sync-update', {
        documentId,
        update: makePayload(Date.now()),
      });
      opsSent++;
    }, intervalMs),
  );

  const start = Date.now();
  await new Promise((r) => setTimeout(r, DURATION_SEC * 1000));
  timers.forEach(clearInterval);

  // Let in-flight broadcasts arrive before measuring/disconnecting.
  await new Promise((r) => setTimeout(r, DRAIN_GRACE_MS));
  const elapsedSec = (Date.now() - start) / 1000;

  sockets.forEach((s) => s.disconnect());

  const sorted = [...stats.latencies].sort((a, b) => a - b);
  console.log('\n--- Results ---');
  console.log(`ops sent:        ${opsSent}`);
  console.log(`ops received:    ${stats.latencies.length} (fan-out acks)`);
  console.log(`throughput:      ${(opsSent / elapsedSec).toFixed(1)} ops/sec sent`);
  console.log(`errors:          ${stats.errors}`);
  console.log(`disconnects:     ${stats.disconnects}`);
  console.log(`latency p50:     ${percentile(sorted, 0.5).toFixed(1)} ms`);
  console.log(`latency p95:     ${percentile(sorted, 0.95).toFixed(1)} ms`);
  console.log(`latency p99:     ${percentile(sorted, 0.99).toFixed(1)} ms`);
  console.log(`latency max:     ${sorted[sorted.length - 1]?.toFixed(1)} ms`);
}

main().catch((err) => {
  console.error('Load test failed:', err);
  process.exit(1);
});
