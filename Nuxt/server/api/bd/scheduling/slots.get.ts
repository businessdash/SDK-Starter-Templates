/**
 * GET /api/bd/scheduling/slots?slug=&from=&to=
 *
 * Wraps `bd.scheduling.getAvailableSlots(...)` so the Booking
 * component can compute availability without holding the API key.
 */
export default defineEventHandler(async (event) => {
	const bd = getBd();
	if (!bd) {
		throw createError({
			statusCode: 503,
			statusMessage: "BD not configured.",
		});
	}
	const query = getQuery(event);
	const slug = query.slug as string | undefined;
	const fromStr = query.from as string | undefined;
	const toStr = query.to as string | undefined;
	if (!slug || !fromStr || !toStr) {
		throw createError({
			statusCode: 400,
			statusMessage: "slug, from, to required",
		});
	}
	try {
		const slots = await bd.scheduling.getAvailableSlots(slug, {
			from: new Date(fromStr),
			to: new Date(toStr),
		});
		return { slots };
	} catch (err) {
		throw createError({
			statusCode: 502,
			statusMessage: err instanceof Error ? err.message : "Unknown error",
		});
	}
});
