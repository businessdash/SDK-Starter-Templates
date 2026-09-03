import type { APIRoute } from "astro";

import { bd } from "../../../../lib/bd";
import { getVisitorToken } from "../../../../lib/bd-store";

export const prerender = false;

/**
 * GET /api/bd/cart/get
 *
 * Read-only cart snapshot for the current visitor. Does NOT mint a token —
 * an empty cart for a brand-new visitor returns `{ cart: null }`.
 */
export const GET: APIRoute = async ({ cookies }) => {
	if (!bd) {
		return Response.json({ cart: null, configured: false });
	}
	const token = getVisitorToken(cookies);
	if (!token) return Response.json({ cart: null });
	try {
		const cart = await bd.cart.forVisitor(token).get();
		return Response.json({ cart });
	} catch (err) {
		const message = err instanceof Error ? err.message : "Couldn't load cart.";
		return Response.json({ error: message }, { status: 502 });
	}
};
