import { $, component$, useSignal, useTask$ } from "@builder.io/qwik";
import { server$ } from "@builder.io/qwik-city";

import { getBd } from "../../lib/bd";

export interface EventType {
	id: string;
	name: string;
	slug: string;
	durationMinutes: number;
}

interface Slot {
	startAt: string;
	endAt: string;
}

/**
 * Server RPCs — Qwik's `server$` compiles these as endpoints that
 * only ever run on the server. Imports of `getBd()` are
 * tree-shaken from the client bundle because they're only reached
 * through server$ call sites.
 */
const fetchSlots = server$(async function (
	this,
	slug: string,
	from: string,
	to: string,
) {
	const bd = getBd();
	if (!bd) throw new Error("BD not configured. See .env.example.");
	return await bd.scheduling.getAvailableSlots(slug, {
		from: new Date(from),
		to: new Date(to),
	});
});

const confirmBooking = server$(async function (
	this,
	input: {
		eventTypeSlug: string;
		startAt: string;
		invitee: {
			email: string;
			name: string;
			phone: string | null;
			timezone: string;
		};
		notes: string | null;
	},
) {
	const bd = getBd();
	if (!bd) throw new Error("BD not configured.");
	return await bd.scheduling.confirmBooking({
		eventTypeSlug: input.eventTypeSlug,
		startAt: new Date(input.startAt),
		invitee: input.invitee,
		notes: input.notes,
	});
});

function startOfTomorrow(): Date {
	const d = new Date();
	d.setDate(d.getDate() + 1);
	d.setHours(0, 0, 0, 0);
	return d;
}
function plusWeek(d: Date): Date {
	const next = new Date(d);
	next.setDate(next.getDate() + 7);
	return next;
}
function formatSlotTime(iso: string): string {
	return new Date(iso).toLocaleString(undefined, {
		weekday: "short",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

export const Booking = component$<{ eventTypes: EventType[] }>(
	({ eventTypes }) => {
		const selectedSlug = useSignal<string>(eventTypes[0]?.slug ?? "");
		const slots = useSignal<Slot[] | null>(null);
		const pickedSlot = useSignal<string | null>(null);
		const inviteeName = useSignal("");
		const inviteeEmail = useSignal("");
		const inviteePhone = useSignal("");
		const inviteeNotes = useSignal("");
		const confirming = useSignal(false);
		const confirmation = useSignal<string | null>(null);
		const error = useSignal<string | null>(null);

		// Re-load slots whenever the selected event type changes.
		useTask$(async ({ track }) => {
			const slug = track(() => selectedSlug.value);
			if (!slug) return;
			slots.value = null;
			pickedSlot.value = null;
			try {
				const from = startOfTomorrow().toISOString();
				const to = plusWeek(startOfTomorrow()).toISOString();
				slots.value = await fetchSlots(slug, from, to);
			} catch (err) {
				error.value = err instanceof Error ? err.message : "Unknown error";
				slots.value = [];
			}
		});

		const handleConfirm = $(async () => {
			if (
				!selectedSlug.value ||
				!pickedSlot.value ||
				!inviteeEmail.value ||
				!inviteeName.value
			)
				return;
			confirming.value = true;
			error.value = null;
			try {
				const result = await confirmBooking({
					eventTypeSlug: selectedSlug.value,
					startAt: pickedSlot.value,
					invitee: {
						email: inviteeEmail.value,
						name: inviteeName.value,
						phone: inviteePhone.value || null,
						timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
					},
					notes: inviteeNotes.value || null,
				});
				confirmation.value = `Booking confirmed (#${result.bookingId.slice(0, 8)}). Check ${inviteeEmail.value} for details.`;
			} catch (err) {
				error.value =
					err instanceof Error ? err.message : "Couldn't confirm.";
			} finally {
				confirming.value = false;
			}
		});

		if (confirmation.value) {
			return (
				<section class="bd-section bd-section--narrow" id="booking">
					<div class="bd-card booking">
						<span class="bd-badge" style="align-self: flex-start;">
							Booked
						</span>
						<h2 class="bd-section__title">You're on the calendar.</h2>
						<p style="color: var(--text);">{confirmation.value}</p>
					</div>
				</section>
			);
		}

		return (
			<section class="bd-section bd-section--narrow" id="booking">
				<div class="bd-section__lead">
					<span class="bd-section__eyebrow">Schedule</span>
					<h2 class="bd-section__title">Book a time</h2>
					<p class="bd-section__sub">
						Pick a slot and we'll send confirmation + a calendar invite.
					</p>
				</div>
				<div class="bd-card booking">
					{eventTypes.length === 0 ? (
						<div class="bd-empty">
							No event types configured yet. Add one in BD at Dashboard →
							Scheduling → Event Types.
						</div>
					) : (
						<>
							<div>
								<label class="bd-label" for="event-type">
									What for?
								</label>
								<select
									bind:value={selectedSlug}
									class="bd-select"
									id="event-type"
								>
									{eventTypes.map((ev) => (
										<option key={ev.slug} value={ev.slug}>
											{`${ev.name} · ${ev.durationMinutes}min`}
										</option>
									))}
								</select>
							</div>

							<div>
								<div class="bd-label">Next available slots</div>
								{slots.value === null ? (
									<div class="bd-loading">Computing availability…</div>
								) : slots.value.length === 0 ? (
									<div class="bd-empty">
										No availability in the next week. Try another event type.
									</div>
								) : (
									<div class="booking__row">
										{slots.value.slice(0, 12).map((slot) => (
											<button
												aria-pressed={pickedSlot.value === slot.startAt}
												class="slot-button"
												key={slot.startAt}
												onClick$={() => {
													pickedSlot.value = slot.startAt;
												}}
												type="button"
											>
												{formatSlotTime(slot.startAt)}
											</button>
										))}
									</div>
								)}
							</div>

							{pickedSlot.value ? (
								<>
									<div class="field-row field-row--cols">
										<div>
											<label class="bd-label" for="booking-name">
												Your name
											</label>
											<input
												bind:value={inviteeName}
												class="bd-input"
												id="booking-name"
												placeholder="Jane Doe"
											/>
										</div>
										<div>
											<label class="bd-label" for="booking-email">
												Email
											</label>
											<input
												bind:value={inviteeEmail}
												class="bd-input"
												id="booking-email"
												placeholder="jane@example.com"
												type="email"
											/>
										</div>
									</div>
									<div>
										<label class="bd-label" for="booking-phone">
											Phone (optional)
										</label>
										<input
											bind:value={inviteePhone}
											class="bd-input"
											id="booking-phone"
											placeholder="(555) 555-0100"
											type="tel"
										/>
									</div>
									<div>
										<label class="bd-label" for="booking-notes">
											Anything we should know?
										</label>
										<textarea
											bind:value={inviteeNotes}
											class="bd-textarea"
											id="booking-notes"
											placeholder="Optional"
										/>
									</div>
									<button
										class="bd-btn"
										disabled={
											confirming.value ||
											!inviteeEmail.value ||
											!inviteeName.value
										}
										onClick$={handleConfirm}
										type="button"
									>
										{confirming.value
											? "Confirming…"
											: `Book ${formatSlotTime(pickedSlot.value)}`}
									</button>
								</>
							) : null}

							{error.value ? (
								<div style="color: var(--danger); background: var(--danger-bg); padding: 0.75rem 1rem; border-radius: 0.5rem; font-size: 0.9rem;">
									{error.value}
								</div>
							) : null}
						</>
					)}
				</div>
			</section>
		);
	},
);
