import type {
	SchedulingEventType,
	SchedulingSlot,
} from "@businessdash/sdk";

import { getBiab, isSuspensionError } from "./biab.server";

/**
 * Booking / scheduling helpers (server-only).
 *
 * Wraps the SDK's Calendly-shape `scheduling` resource: list event types,
 * read available slots for one, and confirm a booking. The `/book` route
 * renders these. Returns empty/`null` when unconfigured so the page degrades
 * to a "scheduling not connected" notice.
 */

export type BookingEventType = {
	slug: string;
	name: string;
	description: string;
	durationMinutes: number;
};

export async function listEventTypes(): Promise<BookingEventType[]> {
	const biab = getBiab();
	if (!biab) return [];
	try {
		const items: SchedulingEventType[] = await biab.scheduling.listEventTypes();
		return items.map((e) => ({
			slug: e.slug,
			name: e.name,
			description: e.description ?? "",
			durationMinutes: e.durationMinutes,
		}));
	} catch (err) {
		if (isSuspensionError(err)) throw err;
		return [];
	}
}

/** Available slots for an event type over the next `days` days. */
export async function listSlots(
	slug: string,
	days = 14,
): Promise<SchedulingSlot[]> {
	const biab = getBiab();
	if (!biab) return [];
	const from = new Date();
	const to = new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
	try {
		return await biab.scheduling.getAvailableSlots(slug, { from, to });
	} catch {
		return [];
	}
}

export type BookingResult =
	| { ok: true; bookingId: string; status: string }
	| { ok: false; error: string };

/** Confirm a booking for an event type at a chosen start time. */
export async function confirmBooking(input: {
	eventTypeSlug: string;
	startAtIso: string;
	name: string;
	email: string;
	timezone: string;
	notes?: string | null;
}): Promise<BookingResult> {
	const biab = getBiab();
	if (!biab) return { ok: false, error: "Scheduling isn't connected." };
	try {
		const res = await biab.scheduling.confirmBooking({
			eventTypeSlug: input.eventTypeSlug,
			startAt: new Date(input.startAtIso),
			invitee: {
				email: input.email,
				name: input.name,
				timezone: input.timezone,
			},
			notes: input.notes ?? null,
		});
		return { ok: true, bookingId: res.bookingId, status: res.status };
	} catch (err) {
		return {
			ok: false,
			error: err instanceof Error ? err.message : "Booking failed.",
		};
	}
}
