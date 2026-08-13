import type { APIRoute } from "astro";

import { biab } from "../../../../lib/biab";
import { getVisitorToken } from "../../../../lib/biab-store";

export const prerender = false;

/**
 * GET /api/biab/cart/get
 *
 * Read-only cart snapshot for the current visitor. Does NOT mint a token —
 * an empty cart for a brand-new visitor returns `{ cart: null }`.
 */
export const GET: APIRoute = async ({ cookies }) => {
	if (!biab) {
		return Response.json({ cart: null, configured: false });
	}
	const token = getVisitorToken(cookies);
	if (!token) return Response.json({ cart: null });
	try {
		const cart = await biab.cart.forVisitor(token).get();
		return Response.json({ cart });
	} catch (err) {
		const message = err instanceof Error ? err.message : "Couldn't load cart.";
		return Response.json({ error: message }, { status: 502 });
	}
};
