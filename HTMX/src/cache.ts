/**
 * Tiny in-memory, tag-keyed TTL cache for the server's BIAB reads.
 *
 * A plain Bun server has no `revalidateTag`, so this is the real cache the
 * revalidation webhook busts. Each cached read stores a value under a key with
 * a set of tags; when BIAB POSTs `/api/biab/revalidate` with the affected tags,
 * `invalidateTags()` drops the matching entries so the next render refetches.
 */

type Entry = { value: unknown; expires: number; tags: string[] };

const store = new Map<string, Entry>();

export const DEFAULT_TTL_MS = 60_000;

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
