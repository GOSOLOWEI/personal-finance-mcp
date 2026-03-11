import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const poolMin = parseInt(process.env.DB_POOL_MIN ?? '2', 10);
const poolMax = parseInt(process.env.DB_POOL_MAX ?? '10', 10);
const connectTimeout = parseInt(process.env.DB_CONNECT_TIMEOUT ?? '10000', 10);

const sql = postgres(connectionString, {
  max: poolMax,
  connect_timeout: connectTimeout / 1000,
  idle_timeout: 30,
  max_lifetime: 3600,
  onnotice: () => {},
});

export const db = drizzle(sql, { schema });
export type Database = typeof db;
