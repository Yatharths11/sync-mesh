import { db } from './index';
/**
 * Inserts a new pending op for a document.
 * Called every time a local edit produces a new Yjs update to queue.
 */
export function insertOp(documentId: string, content: Uint8Array): void {
  db.executeSync(
    'INSERT INTO pending_ops (documentId, content, createdAt) VALUES (?, ?, ?)',
    [documentId, content, Date.now()],
  );
}

/**
 * Returns all pending ops for a document, in insertion order.
 * Called by the sync loop when draining the queue.
 */
export function getPendingOps(
  documentId: string,
): Array<{ id: number; content: Uint8Array; createdAt: number }> {
  const { rows } = db.executeSync(
    'SELECT id, content, createdAt FROM pending_ops WHERE documentId = ? ORDER BY id',
    [documentId],
  );

  return rows.map(row => ({
    id: row.id as number,
    // op-sqlite hands BLOBs back as ArrayBuffer
    content: new Uint8Array(row.content as ArrayBuffer),
    createdAt: row.createdAt as number,
  }));
}

/**
 * Deletes a single op by id, called after the server confirms receipt.
 */
export function deleteOp(id: number): void {
  db.executeSync('DELETE FROM pending_ops WHERE id = ?', [id]);
}
