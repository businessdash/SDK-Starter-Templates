import { error, json } from "@sveltejs/kit";

import { bd } from "$lib/server/bd";

import type { RequestHandler } from "./$types";

/**
 * POST /api/bd/scheduling/bookings
 *
 * Confirm a booking. Returns the new authoritative state (booking
 * id + signed manage/reschedule/cancel tokens) so the client can
 * swap in the success view without a refetch.
 */
export const POST: RequestHandler = async ({ request }) => {
	if (!bd) {
		throw error(503, "BD not configured. See .env.example.");
	}
	try {
		const body = (await request.json()) as {
			eventTypeSlug: string;
			startAt: string;
			invitee: {
				email: string;
				name: string;
				phone?: string | null;
				timezone: string;
			};
			notes?: string | null;
		};
		const result = await bd.scheduling.confirmBooking({
			eventTypeSlug: body.eventTypeSlug,
			startAt: new Date(body.startAt),
			invitee: body.invitee,
			notes: body.notes ?? null,
		});
		return json(result);
	} catch (err) {
		const message = err instanceof Error ? err.message : "Couldn't confirm.";
		throw error(400, message);
	}
};
