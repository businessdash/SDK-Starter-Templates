import type { PageServerLoad } from "./$types";

import { biab } from "$lib/server/biab";
import { isStoreConfigured } from "$lib/server/biab-store";

/**
 * Post-checkout "thank you" page. Stripe redirects here with
 * `?session_id=…`; we confirm payment via `checkout.getStatus(sessionId)`
 * before showing the receipt. Works for both product and subscription
 * checkouts (both return a Stripe Checkout Session).
 */
export const load: PageServerLoad = async ({ url }) => {
	const sessionId = url.searchParams.get("session_id");
	if (!isStoreConfigured() || !biab || !sessionId) {
		return { status: null };
	}
	try {
		const status = await biab.checkout.getStatus(sessionId);
		return { status };
	} catch {
		return { status: null };
	}
};
