import { db } from './index';

/**
 * Returns the highest server sequence number this client has applied for a
 * document, or 0 if it has never synced.
 */
export function getLastSeenSeq(documentId: string): number {
  const { rows } = db.executeSync(
    'SELECT lastSeenSeq FROM document_sync_state WHERE documentId = ?',
    [documentId],
  );

  return rows.length ? (rows[0].lastSeenSeq as number) : 0;
}

/**
 * Records the highest server sequence number this client has applied for a
 * document, so the next pull only asks for what's new.
 */
export function setLastSeenSeq(documentId: string, seq: number): void {
  db.executeSync(
    `INSERT INTO document_sync_state (documentId, lastSeenSeq) VALUES (?, ?)
     ON CONFLICT(documentId) DO UPDATE SET lastSeenSeq = excluded.lastSeenSeq`,
    [documentId, seq],
  );
}
