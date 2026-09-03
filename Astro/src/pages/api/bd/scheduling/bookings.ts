import type { APIRoute } from "astro";

import { bd } from "../../../../lib/bd";

export const prerender = false;

/**
 * POST /api/bd/scheduling/bookings
 *
 * Confirm a booking. Returns the new authoritative state — booking
 * id + the signed manage/reschedule/cancel tokens — so the client
 * island can swap in the success view without a refetch.
 */
export const POST: APIRoute = async ({ request }) => {
	if (!bd) {
		return Response.json(
			{ error: "BD not configured. See .env.example." },
			{ status: 503 },
		);
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
		return Response.json(result);
	} catch (err) {
		const message = err instanceof Error ? err.message : "Couldn't confirm.";
		return Response.json({ error: message }, { status: 400 });
	}
};
