import { z } from "zod";

/**
 * POST /api/biab/portal/submit-review
 *
 * Validate + submit a review as the signed-in customer. The review
 * lands as `status: 'pending'` until staff moderates it. Requires a
 * valid `biab_session` cookie — `submitCustomerReview` throws if the
 * caller isn't signed in, which we surface as a 401.
 */
const reviewSchema = z.object({
	rating: z.coerce.number().int().min(1).max(5),
	title: z.string().trim().max(200).optional(),
	body: z.string().trim().min(1, "Please write a few words.").max(5000),
	jobId: z
		.string()
		.uuid()
		.optional()
		.or(z.literal("").transform(() => undefined)),
});

export default defineEventHandler(async (event) => {
	if (!isCustomerPortalConfigured()) {
		throw createError({
			statusCode: 503,
			statusMessage: "Customer portal isn't configured.",
		});
	}

	const raw = await readBody(event);
	const parsed = reviewSchema.safeParse(raw);
	if (!parsed.success) {
		throw createError({
			statusCode: 400,
			statusMessage:
				parsed.error.issues[0]?.message ?? "Please fix the highlighted fields.",
		});
	}

	try {
		const res = await submitCustomerReview(event, parsed.data);
		return { ok: true, status: res.status };
	} catch (err) {
		const reason = err instanceof Error ? err.message : String(err);
		throw createError({
			statusCode: reason === "Not signed in." ? 401 : 400,
			statusMessage:
				reason === "Not signed in."
					? "You need to be signed in to leave a review."
					: "We couldn't submit your review.",
		});
	}
});
