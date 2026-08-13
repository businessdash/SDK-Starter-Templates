import type { PageServerLoad } from "./$types";

import {
	getCartSnapshot,
	isStoreConfigured,
	listStoreSubscriptions,
} from "$lib/server/biab-store";

/**
 * Subscriptions list. Recurring offerings from `subscriptions.list`.
 * Starting a subscription checkout goes through the
 * `/api/biab/subscriptions/[id]/checkout` endpoint.
 */
export const load: PageServerLoad = async ({ cookies }) => {
	if (!isStoreConfigured()) {
		return { configured: false as const, subscriptions: [], cartCount: 0 };
	}
	const [list, cart] = await Promise.all([
		listStoreSubscriptions(),
		getCartSnapshot(cookies),
	]);
	return {
		configured: true as const,
		subscriptions: list?.items ?? [],
		cartCount: cart?.itemCount ?? 0,
	};
};
