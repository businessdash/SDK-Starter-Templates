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
};

export default defineEventHandler(
	async (): Promise<StoreSubscriptionsResult> => {
		const bd = getBd();
		if (!bd) return { items: [], suspended: false };
		try {
			const res = await bd.subscriptions.list();
			return { items: res.items, suspended: false };
		} catch (err) {
			if (
				err instanceof BdServiceSuspendedError ||
				err instanceof BdPaymentLapsedError
			) {
				return { items: [], suspended: true };
			}
			return { items: [], suspended: false };
		}
	},
);
