import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { getConfig } from '../config';

const client = postgres(getConfig().DATABASE_URL, { max: 1 });
try {
  await migrate(drizzle(client), { migrationsFolder: './drizzle' });
  console.log('migrations applied');
} finally {
  await client.end();
}
