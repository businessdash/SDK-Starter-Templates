import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { env } from '$env/dynamic/private';
import * as schema from './schema';

/**
 * The BD Web Content SDK needs NO database. This template ships example
 * Drizzle/libSQL bits behind `DATABASE_URL`, which is now optional — so an
 * unconfigured clone boots and renders BD content instead of crashing.
 *
 * When `DATABASE_URL` is unset, `db` is a proxy that throws only if you actually
 * touch it (use those example DB features), with a message telling you what to
 * do — never at import/boot time.
 */
function createDb(): LibSQLDatabase<typeof schema> {
	if (!env.DATABASE_URL) {
		return new Proxy({} as LibSQLDatabase<typeof schema>, {
			get() {
				throw new Error(
					'DATABASE_URL is not set. The BD Web Content SDK needs no database; ' +
						"set it only if you use this starter's example DB features."
				);
			}
		});
	}
	const client = createClient({ url: env.DATABASE_URL });
	return drizzle(client, { schema });
}

export const db = createDb();
