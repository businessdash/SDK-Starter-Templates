import type { PageServerLoad } from "./$types";

import { getCartSnapshot, isStoreConfigured } from "$lib/server/bd-store";

/**
 * Cart view. Loads the current snapshot read-only (no cookie mint); the
 * page's mutations go through the `/api/bd/cart/*` endpoints and update
 * the snapshot in place client-side.
 */
export const load: PageServerLoad = async ({ cookies }) => {
	if (!isStoreConfigured()) {
		return { configured: false as const, snapshot: null };
	}
	const snapshot = await getCartSnapshot(cookies);
	return { configured: true as const, snapshot };
};
