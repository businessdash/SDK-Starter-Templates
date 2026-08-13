import {
	BiabPaymentLapsedError,
	BiabServiceSuspendedError,
} from "@businessdash/sdk";
import type { SubscriptionOfferingsListResponse } from "@businessdash/sdk/contracts";

/**
 * GET /api/biab/store/subscriptions
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
		const biab = getBiab();
		if (!biab) return { items: [], suspended: false };
		try {
			const res = await biab.subscriptions.list();
			return { items: res.items, suspended: false };
		} catch (err) {
			if (
				err instanceof BiabServiceSuspendedError ||
				err instanceof BiabPaymentLapsedError
			) {
				return { items: [], suspended: true };
			}
			return { items: [], suspended: false };
		}
	},
);
