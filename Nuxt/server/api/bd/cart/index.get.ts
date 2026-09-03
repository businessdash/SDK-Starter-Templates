import type { CartSnapshot } from "@businessdash/sdk/contracts";

/**
 * GET /api/bd/cart
 *
 * Read-only cart snapshot for the current visitor. Returns
 * `{ cart: null }` when the store isn't configured or the visitor
 * has no cart yet (no `bd_cart_visitor` cookie) — this read never
 * mints the cookie, so it's safe to call on every page load.
 */
export default defineEventHandler(
	async (event): Promise<{ cart: CartSnapshot | null }> => {
		const bd = getBd();
		if (!bd) return { cart: null };
		const token = readVisitorToken(event);
		if (!token) return { cart: null };
		try {
			const cart = await bd.cart.forVisitor(token).get();
			return { cart };
		} catch {
			return { cart: null };
		}
	},
);
