import { Pool, type PoolClient } from 'pg';

const globalDb = globalThis as unknown as { zoraPool?: Pool };
export function database(): Pool {
  if (!process.env.DATABASE_URL) throw new Error('Database is not configured');
  // Preserve the provider's SSL configuration; never set rejectUnauthorized:false.
  return globalDb.zoraPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 3, idleTimeoutMillis: 10000, connectionTimeoutMillis: 10000 });
}
export async function transaction<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await database().connect();
  try { await client.query('BEGIN'); const result = await run(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
