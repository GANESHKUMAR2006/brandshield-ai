import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

let pool: Pool | null = null;
let testQueryOverride: ((text: string, params?: unknown[]) => Promise<any>) | null = null;

/**
 * Test-only hook to inject mock database responses during automated unit tests.
 * Strictly blocked in production environments.
 */
export function __setTestQueryOverride(
  override: ((text: string, params?: unknown[]) => Promise<any>) | null
): void {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_APP_ENV === "production"
  ) {
    throw new Error("Test query override is strictly prohibited in production.");
  }
  testQueryOverride = override;
}

export function getDbPool(): Pool {
  if (pool) return pool;

  const connectionString =
    process.env.SUPABASE_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL;

  if (!connectionString) {
    throw new Error(
      "Database connection string is not configured. Please set SUPABASE_DATABASE_URL (or DATABASE_URL) in server environment."
    );
  }

  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_APP_ENV !== "production" &&
    testQueryOverride
  ) {
    return testQueryOverride(text, params);
  }
  const p = getDbPool();
  return p.query<T>(text, params);
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const p = getDbPool();
  const client = await p.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
