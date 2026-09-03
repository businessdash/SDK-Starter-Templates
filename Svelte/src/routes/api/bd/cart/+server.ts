import { json } from "@sveltejs/kit";

import { getCartSnapshot, isStoreConfigured } from "$lib/server/bd-store";

import type { RequestHandler } from "./$types";

/**
 * GET /api/bd/cart — current cart snapshot for the visitor cookie.
 *
 * Read-only, so it never mints the cookie: returns `{ snapshot: null }`
 * until the first mutation creates one. The bearer key stays server-side;
 * the browser only ever sees the serialized snapshot.
 */
export const GET: RequestHandler = async ({ cookies }) => {
	if (!isStoreConfigured()) {
		return json({ configured: false, snapshot: null });
	}
	const snapshot = await getCartSnapshot(cookies);
	return json({ configured: true, snapshot });
};
