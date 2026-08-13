/**
 * Tiny tag-keyed in-memory TTL cache (server-only).
 *
 * Remix has no built-in tag cache the way Next.js does (`revalidateTag`),
 * so the BIAB → consumer revalidation webhook has nothing to call. This
 * module fills that gap: server reads memoise their result under one or
 * more BIAB cache tags (`biab:gallery`, `biab:catalog`, `biab:reviews`, …),
 * and the webhook (`app/routes/api.biab.revalidate.ts`) drops every entry
 * carrying a published tag. The result: a BIAB publish busts exactly the
 * right slice within seconds, with a short TTL as a self-healing backstop.
 *
 * It's deliberately small (single process, no LRU eviction beyond TTL). A
 * production multi-instance deploy would swap this for Redis/Upstash and
 * fan the webhook out to every instance — but the call-site contract
 * (`cached(key, tags, ttl, loader)` + `invalidateTags(tags)`) stays the same.
 */

type Entry = {
	value: unknown;
	expiresAt: number;
	tags: string[];
};

const store = new Map<string, Entry>();

/** Default freshness window. Webhook invalidation handles the common case;
 *  this only catches a missed delivery. 60s keeps dev iteration snappy. */
const DEFAULT_TTL_MS = 60_000;

/**
 * Memoise an async loader under a cache key + a set of BIAB tags. On a hit
 * within the TTL the cached value is returned without calling `loader`.
 * `invalidateTags(...)` (driven by the webhook) force-expires matching keys.
 */
export async function cached<T>(
	key: string,
	tags: string[],
	loader: () => Promise<T>,
	ttlMs: number = DEFAULT_TTL_MS,
): Promise<T> {
	const now = Date.now();
	const hit = store.get(key);
	if (hit && hit.expiresAt > now) {
		return hit.value as T;
	}
	const value = await loader();
	store.set(key, { value, expiresAt: now + ttlMs, tags });
	return value;
}

/**
 * Drop every cache entry that carries at least one of the given tags.
 * Returns the number of entries evicted (handy for webhook logging).
 */
export function invalidateTags(tags: string[]): number {
	if (tags.length === 0) return 0;
	const wanted = new Set(tags);
	let dropped = 0;
	for (const [key, entry] of store) {
		if (entry.tags.some((t) => wanted.has(t))) {
			store.delete(key);
			dropped += 1;
		}
	}
	return dropped;
}

/** Clear the whole cache. Mainly for tests / a "flush all" admin action. */
export function invalidateAll(): void {
	store.clear();
}
