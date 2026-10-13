import { readFile } from 'node:fs/promises';
import { database } from '../lib/db';

async function main() {
  const sql = await readFile(new URL('../db/001_init.sql', import.meta.url), 'utf8');
  const db = database();
  try {
    await db.query(sql);
    console.log('Zora schema migration completed.');
  } finally { await db.end(); }
}
main().catch(error => { console.error('Database migration failed:', error instanceof Error ? error.name : 'unknown'); process.exitCode = 1; });
