/**
 * POST /api/bd/scheduling/bookings
 *
 * Confirm a booking. Returns the new authoritative state (booking
 * id + signed manage/reschedule/cancel tokens) so the Booking
 * component can swap in the success view without a refetch.
 */
export default defineEventHandler(async (event) => {
	const bd = getBd();
	if (!bd) {
		throw createError({
			statusCode: 503,
			statusMessage: "BD not configured.",
		});
	}
	const body = await readBody<{
		eventTypeSlug: string;
		startAt: string;
		invitee: {
			email: string;
			name: string;
			phone?: string | null;
			timezone: string;
		};
		notes?: string | null;
	}>(event);
	try {
		return await bd.scheduling.confirmBooking({
			eventTypeSlug: body.eventTypeSlug,
			startAt: new Date(body.startAt),
			invitee: body.invitee,
			notes: body.notes ?? null,
		});
	} catch (err) {
		throw createError({
			statusCode: 400,
			statusMessage: err instanceof Error ? err.message : "Couldn't confirm.",
		});
	}
});
