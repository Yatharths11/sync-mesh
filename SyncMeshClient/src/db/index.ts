import { open } from '@op-engineering/op-sqlite';

const db = open({ name: 'syncmesh.db' }); // opens/creates the db file on device

function initDb(): void {
  db.execute(`
		CREATE TABLE IF NOT EXISTS pending_ops (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			documentId TEXT NOT NULL,
			content BLOB NOT NULL,
			createdAt INTEGER NOT NULL,
			opId TEXT NOT NULL
		);
	`);

  db.execute(`
		CREATE INDEX IF NOT EXISTS idx_pending_ops_document ON pending_ops (documentId, id);
	`);

  db.execute(`
		CREATE TABLE IF NOT EXISTS document_sync_state (
			documentId TEXT PRIMARY KEY,
			lastSeenSeq INTEGER NOT NULL DEFAULT 0
		);
	`);
}

export { db, initDb };
