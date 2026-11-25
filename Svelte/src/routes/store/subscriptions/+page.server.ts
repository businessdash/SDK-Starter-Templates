// [bd-file:subscriptions]
import type { PageServerLoad } from './$types';

// [bd:store]
import { getCartSnapshot } from '#lib/server/bd-store.ts';
// [/bd:store]
import { isStoreConfigured, listStoreSubscriptions } from '#lib/server/bd-store.ts';
import { getCustomerSession, SESSION_COOKIE } from '#lib/server/bd-portal.ts';

/**
 * Subscriptions list. Recurring offerings from `subscriptions.list`.
 * Starting a subscription checkout goes through the
 * `/api/bd/subscriptions/[id]/checkout` endpoint, for a signed-in customer;
 * anyone else is offered sign-in first.
 */
export const load: PageServerLoad = async ({ cookies }) => {
	if (!isStoreConfigured()) {
		return { configured: false as const, subscriptions: [], cartCount: 0, signedIn: false };
	}
	const [list, session] = await Promise.all([
		listStoreSubscriptions(),
		getCustomerSession(cookies.get(SESSION_COOKIE))
	]);
	// The cart badge in the store's sub-nav; a project without a store has none.
	let cartCount = 0;
	// [bd:store]
	cartCount = (await getCartSnapshot(cookies))?.itemCount ?? 0;
	// [/bd:store]
	return {
		configured: true as const,
		subscriptions: list?.items ?? [],
		cartCount,
		signedIn: session !== null
	};
};
