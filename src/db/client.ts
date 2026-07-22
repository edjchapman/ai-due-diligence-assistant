import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getConfig } from '../config';
import * as schema from './schema';

export const sql = postgres(getConfig().DATABASE_URL);
export const db = drizzle(sql, { schema });
