import { db } from './index';
import { v4 as uuidv4 } from 'uuid';

/**
 * Inserts a new pending op for a document.
 * Called every time a local edit produces a new Yjs update to queue.
 */
export function insertOp(documentId: string, content: Uint8Array): void {
  db.executeSync(
    'INSERT INTO pending_ops (documentId, content, createdAt, opId) VALUES (?, ?, ?, ?)',
    [documentId, content, Date.now(), uuidv4()],
  );
}

/**
 * Returns all pending ops for a document, in insertion order.
 * Called by the sync loop when draining the queue.
 */
export function getPendingOps(
  documentId: string,
): Array<{ id: number; opId: string; content: Uint8Array; createdAt: number }> {
  const { rows } = db.executeSync(
    'SELECT id, opId, content, createdAt FROM pending_ops WHERE documentId = ? ORDER BY id',
    [documentId],
  );

  return rows.map(row => ({
    id: row.id as number,
    opId: row.opId as string,
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
