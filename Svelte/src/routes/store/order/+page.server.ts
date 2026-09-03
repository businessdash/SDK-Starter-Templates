import type { PageServerLoad } from "./$types";

import { bd } from "$lib/server/bd";
import { isStoreConfigured } from "$lib/server/bd-store";

/**
 * Post-checkout "thank you" page. Stripe redirects here with
 * `?session_id=…`; we confirm payment via `checkout.getStatus(sessionId)`
 * before showing the receipt. Works for both product and subscription
 * checkouts (both return a Stripe Checkout Session).
 */
export const load: PageServerLoad = async ({ url }) => {
	const sessionId = url.searchParams.get("session_id");
	if (!isStoreConfigured() || !bd || !sessionId) {
		return { status: null };
	}
	try {
		const status = await bd.checkout.getStatus(sessionId);
		return { status };
	} catch {
		return { status: null };
	}
};
