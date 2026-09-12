# SyncMesh

An offline-first collaborative document editor, built to prove out real distributed-systems mechanics — not a CRUD app with a WebSocket bolted on.

**The claim this repo backs up:** put two phones in airplane mode, edit the same document independently and offline on each, reconnect both — and they converge to byte-identical state. No server round-trip required to resolve the conflict; the CRDT merge does it.

## Why this exists

This is an 8-week structured build meant to demonstrate depth in four areas that come up constantly in senior backend / distributed-systems interviews, but that most side projects never actually exercise:

- **CRDT convergence** — concurrent, order-independent merge (Yjs), not last-write-wins
- **Horizontal WebSocket scaling** — cross-instance fan-out via Redis pub/sub, not a single in-memory Socket.io room
- **Offline sync protocol** — a real client-side queue and reconnect/replay flow, not "hope you stayed online"
- **Session revocation that's actually enforced** — revoking a device tears down its live socket connection, not just its ability to get a new token

## Architecture

**Client** — React Native (CLI, not Expo) · Yjs (CRDT engine) · SQLite offline queue (`op-sqlite`)
**Server** — NestJS · Socket.io (WebSocket gateway) · Redis (pub/sub fan-out) · PostgreSQL via Prisma (append-only operation log)
**Auth** — short-lived stateless access tokens + DB-checked, revocable refresh tokens; per-device session table (`Device`), one row per login, not per physical hardware

```
┌─────────────┐        WebSocket (JWT auth on connect)        ┌──────────────┐
│ RN Client A │ ─────────────────────────────────────────────▶│  NestJS      │
│ (Yjs + SQLite queue)                                          │  Gateway A   │
└─────────────┘                                                 └──────┬───────┘
                                                                        │ Redis pub/sub
┌─────────────┐                                                        │ (cross-instance
│ RN Client B │◀───────────────────────────────────────────────┐       │  fan-out)
└─────────────┘                                                 ┌──────▼───────┐
                                                                 │  NestJS      │
                                                                 │  Gateway B   │
                                                                 └──────┬───────┘
                                                                        │
                                                                 ┌──────▼───────┐
                                                                 │  PostgreSQL   │
                                                                 │  (Prisma,     │
                                                                 │  append-only  │
                                                                 │  DocumentOp)  │
                                                                 └──────────────┘
```

## Status

This is a work in progress, updated honestly as I go — not backdated to look finished.

- [x] Auth: refresh-token rotation + reuse detection, per-device revocation
- [x] WebSocket gateway: manual per-connection JWT verification, per-document room authorization
- [x] CRDT convergence: Yjs integrated; 5-scenario Jest suite passing (concurrent inserts, concurrent delete+insert, out-of-order delivery, idempotency, three-way divergence)
- [x] Cross-instance **session revocation** fan-out via Redis pub/sub
- [ ] Offline queue + reconnect sync protocol — server-side `pull`/`push` handlers done; client-side drain/pull loops in progress
- [ ] Two-device airplane-mode convergence demo
- [ ] Cross-instance **CRDT op broadcast** via Redis pub/sub (currently single-instance only — this is the next major piece, not an afterthought)

## Running locally

> Adjust script names below to match what's actually in `package.json` in each folder — filling these in from the project layout, not a verified `npm run` list.

```bash
# Infra
docker compose up -d      # Postgres 16 + Redis 7

# Backend
cd syncmesh-backend
npm install
npx prisma migrate dev
npm run start:dev

# Client
cd SyncMeshClient
npm install
npx react-native run-android   # or run-ios
```

## Testing

```bash
cd syncmesh-backend
npm run test   # Yjs CRDT convergence suite
```

## Design decisions worth asking about

A few choices here were deliberate tradeoffs, not defaults:

- **`id` (client UUID) vs. `seq` (server-assigned BigInt)** on every op — `id` for idempotent dedup, `seq` for ordering and cheap catch-up queries. Clients can't self-assign `seq`; offline coordination makes that a collision risk.
- **Cursor-based pagination**, not offset — offset breaks under concurrent writes; `seq` gives a stable monotonic cursor.
- **SQLite over AsyncStorage** on the client — the deciding factor was transactional consistency with other local writes, not query features.
- **Push/pull stays on the WebSocket**, not REST — the socket carries a revocation-aware session verified once at connect; REST would need a DB lookup per request to catch revoked devices.
- **Append-only `DocumentOp` table** — CRDT merge needs operation history, not just current state, so nothing is ever updated or deleted, only inserted.

## License

MIT (or update to whatever you intend to use)
