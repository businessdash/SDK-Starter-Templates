import type { CartSnapshot } from "@businessdash/sdk/contracts";

/**
 * GET /api/biab/cart
 *
 * Read-only cart snapshot for the current visitor. Returns
 * `{ cart: null }` when the store isn't configured or the visitor
 * has no cart yet (no `biab_cart_visitor` cookie) — this read never
 * mints the cookie, so it's safe to call on every page load.
 */
export default defineEventHandler(
	async (event): Promise<{ cart: CartSnapshot | null }> => {
		const biab = getBiab();
		if (!biab) return { cart: null };
		const token = readVisitorToken(event);
		if (!token) return { cart: null };
		try {
			const cart = await biab.cart.forVisitor(token).get();
			return { cart };
		} catch {
			return { cart: null };
		}
	},
);
