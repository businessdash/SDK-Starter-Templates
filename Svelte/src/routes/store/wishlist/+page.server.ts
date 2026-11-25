// [bd-file:store]
import type { PageServerLoad } from './$types';

import { getCartSnapshot } from '#lib/server/bd-store.ts';

/**
 * The wishlist lives in the visitor's browser, so the server only supplies
 * the cart count for the store nav.
 */
export const load: PageServerLoad = async ({ cookies }) => {
	const cart = await getCartSnapshot(cookies);
	return { cartCount: cart?.itemCount ?? 0 };
};
