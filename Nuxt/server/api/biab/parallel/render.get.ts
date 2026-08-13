import {
	BiabPaymentLapsedError,
	BiabServiceSuspendedError,
} from "@businessdash/sdk";
import type { ParallelPagesRenderResponse } from "@businessdash/sdk";

/**
 * GET /api/biab/parallel/render?key=service-area&service=…&area=…
 *
 * Render one parallel-page variant. BIAB resolves the brand/area/service
 * tokens server-side, so the returned `meta.title/description/canonical`
 * and `body` are fully expanded — crawlers see finished HTML.
 *
 * `state` distinguishes the failure modes so the page can choose its
 * response:
 *   - `ok`        → render the variant
 *   - `not-found` → 404 (unknown slug / unconfigured)
 *   - `suspended` → 503 "temporarily unavailable" (billing suspended)
 */
export type ParallelRenderResult =
	| { state: "ok"; variant: ParallelPagesRenderResponse }
	| { state: "not-found" }
	| { state: "suspended" };

export default defineEventHandler(
	async (event): Promise<ParallelRenderResult> => {
		const biab = getBiab();
		if (!biab) return { state: "not-found" };

		const query = getQuery(event);
		const key = (query.key as string) || "service-area";
		const service = query.service as string | undefined;
		const area = query.area as string | undefined;
		if (!service || !area) return { state: "not-found" };

		try {
			const variant = await biab.parallelPages.render(key, { service, area });
			return { state: "ok", variant };
		} catch (err) {
			if (err instanceof BiabServiceSuspendedError) {
				setResponseStatus(event, 503);
				return { state: "suspended" };
			}
			if (err instanceof BiabPaymentLapsedError) {
				// Static reads are flagged allowed-in-lapsed-state on the server;
				// if one slips through, fall back to not-found rather than a
				// half-broken page.
				return { state: "not-found" };
			}
			return { state: "not-found" };
		}
	},
);
