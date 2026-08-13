/**
 * Tiny in-memory, tag-keyed TTL cache for the server's BIAB reads.
 *
 * Frameworks like Next give you `revalidateTag`; a plain Bun server doesn't,
 * so this is the real cache the revalidation webhook busts. Every cached read
 * is stored under a key with a set of tags (e.g. `biab:marketing`,
 * `biab:catalog`). When BIAB publishes a change it POSTs `/api/biab/revalidate`
 * with the affected tags; `invalidateTags()` drops every matching entry so the
 * next request refetches fresh data — no redeploy, no stale page.
 */

type Entry = { value: unknown; expires: number; tags: string[] };

const store = new Map<string, Entry>();

/** Default freshness window for cached reads (ms). */
export const DEFAULT_TTL_MS = 60_000;

/**
 * Run `fn` at most once per `ttlMs` per `key`. Subsequent calls within the
 * window return the cached value. The entry is dropped early if the webhook
 * invalidates any of its `tags`.
 */
export async function cached<T>(
	key: string,
	tags: string[],
	fn: () => Promise<T>,
	ttlMs: number = DEFAULT_TTL_MS,
): Promise<T> {
	const now = Date.now();
	const hit = store.get(key);
	if (hit && hit.expires > now) return hit.value as T;
	const value = await fn();
	store.set(key, { value, expires: now + ttlMs, tags });
	return value;
}

/**
 * Drop every cache entry tagged with any of `tags`. Returns the number of
 * entries evicted. An empty/missing tag list clears everything (the safe
 * default for a "something changed" webhook with no tag detail).
 */
export function invalidateTags(tags: string[]): number {
	if (!tags || tags.length === 0) {
		const n = store.size;
		store.clear();
		return n;
	}
	const wanted = new Set(tags);
	let evicted = 0;
	for (const [key, entry] of store) {
		if (entry.tags.some((t) => wanted.has(t))) {
			store.delete(key);
			evicted++;
		}
	}
	return evicted;
}
