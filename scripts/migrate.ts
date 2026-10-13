import { readFile } from 'node:fs/promises';
import { database } from '../lib/db';
import { neon } from '@neondatabase/serverless';

async function main() {
  const sql = await readFile(new URL('../db/001_init.sql', import.meta.url), 'utf8');
  const connection = process.env.DATABASE_URL;
  if (!connection) throw new Error('Database is not configured');
  // Codex cloud supports HTTPS egress; direct PostgreSQL sockets may be unavailable.
  // Use Neon's supported HTTPS transport only for a verified Neon connection hostname.
  if (new URL(connection).hostname.endsWith('.neon.tech')) {
    const query = neon(connection);
    // Explicit SQL-file boundaries avoid splitting quoted SQL or function bodies.
    const statements = sql.split(/^-- zora:statement-breakpoint$/m).map(s => s.trim()).filter(Boolean);
    await query.transaction(statements.map(statement => query.query(statement, [])));
    console.log('Zora schema migration completed through Neon HTTPS.');
    return;
  }
  const db = database();
  try {
    await db.query(sql);
    console.log('Zora schema migration completed.');
  } finally { await db.end(); }
}
main().catch(error => { console.error('Database migration failed:', error instanceof Error ? error.name : 'unknown'); process.exitCode = 1; });
