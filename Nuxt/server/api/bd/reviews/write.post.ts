import { checkReview } from "#shared/bd/reviews";

/**
 * POST /api/bd/reviews/write  { rating, title?, body }
 *
 * A review of the business from the signed-in customer, checked again here
 * with the shared rules. It waits for the business to approve it.
 */
export default defineEventHandler(async (event) => {
	if (!getBd()) throw createError({ statusCode: 503, statusMessage: "Reviews aren't connected yet." });
	const checked = checkReview((await readBody(event).catch(() => null)) ?? {});
	if (!checked.ok) throw createError({ statusCode: 400, statusMessage: checked.error });
	try {
		await submitCustomerReview(event, checked.review);
		return { ok: true };
	} catch (err) {
		if (err instanceof Error && err.message === "Not signed in.") {
			throw createError({ statusCode: 401, statusMessage: "Sign in to write a review." });
		}
		throw createError({ statusCode: 502, statusMessage: "Couldn't send your review. Try again." });
	}
});
