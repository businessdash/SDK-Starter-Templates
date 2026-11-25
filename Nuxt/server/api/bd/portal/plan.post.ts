// [bd-file:subscriptions]
import { z } from "zod";

/**
 * POST /api/bd/portal/plan  { intent: "cancel" | "resume" }
 *
 * Cancel the signed-in customer's plan at the end of the paid period, or
 * take a pending cancel back. Returns what is true now, because the stored
 * status lags until the payment provider confirms.
 */
const bodySchema = z.object({ intent: z.enum(["cancel", "resume"]) });

export default defineEventHandler(async (event) => {
	const parsed = bodySchema.safeParse(await readBody(event));
	if (!parsed.success) {
		throw createError({ statusCode: 400, statusMessage: "Unknown change." });
	}
	try {
		const res = await setPlanCancelled(event, parsed.data.intent === "cancel");
		return { cancelAtPeriodEnd: res.cancelAtPeriodEnd, accessUntil: res.accessUntil };
	} catch {
		throw createError({
			statusCode: 400,
			statusMessage: "We couldn't change your plan. Please try again.",
		});
	}
});
