import { db } from './index';

/**
 * Returns the stored value for a settings key, or null if it has never been set.
 */
export function getSetting(key: string): string | null {
  const { rows } = db.executeSync(
    'SELECT value FROM app_settings WHERE key = ?',
    [key],
  );

  return rows.length ? (rows[0].value as string) : null;
}

/**
 * Persists a settings key/value pair, overwriting any existing value.
 */
export function setSetting(key: string, value: string): void {
  db.executeSync(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}
