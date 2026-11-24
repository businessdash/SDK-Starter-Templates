// [bd-file:saas]
import {
	BdPaymentLapsedError,
	BdServiceSuspendedError,
} from "@businessdash/sdk";
import type { SubscriptionOfferingsListResponse } from "@businessdash/sdk/contracts";

/**
 * GET /api/bd/store/subscriptions
 *
 * Live recurring-plan offerings. Returns `{ items: [] }` when
 * unconfigured / suspended so the subscriptions page degrades to an
 * empty state.
 */
export type StoreSubscriptionsResult = {
	items: SubscriptionOfferingsListResponse["items"];
	suspended: boolean;
	/** Subscribing needs a signed-in customer; anyone else signs in first. */
	signedIn: boolean;
};

export default defineEventHandler(
	async (event): Promise<StoreSubscriptionsResult> => {
		const bd = getBd();
		if (!bd) return { items: [], suspended: false, signedIn: false };
		try {
			const [res, session] = await Promise.all([
				bd.subscriptions.list(),
				getCustomerSession(event),
			]);
			return { items: res.items, suspended: false, signedIn: session !== null };
		} catch (err) {
			if (
				err instanceof BdServiceSuspendedError ||
				err instanceof BdPaymentLapsedError
			) {
				return { items: [], suspended: true, signedIn: false };
			}
			return { items: [], suspended: false, signedIn: false };
		}
	},
);
