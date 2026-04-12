import { Pool, type QueryResultRow } from "pg";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://zomato:zomato_secret@postgres:5432/zomato_health";

declare global {
  // eslint-disable-next-line no-var
  var __healthCheckPool: Pool | undefined;
}

function createPool() {
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
  });
}

export const pool = global.__healthCheckPool || createPool();

if (!global.__healthCheckPool) {
  global.__healthCheckPool = pool;
}

export async function query<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
) {
  return pool.query<T>(text, params);
}
