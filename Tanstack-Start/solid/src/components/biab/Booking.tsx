import { createEffect, createSignal, For, Show } from "solid-js";

import {
	confirmBooking,
	type EventType,
	fetchSlots,
} from "../../lib/biab-server-fns";

type Slot = { startAt: string; endAt: string };

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

export function Booking(props: { eventTypes: EventType[] }) {
	const [selectedSlug, setSelectedSlug] = createSignal<string>(
		props.eventTypes[0]?.slug ?? "",
	);
	const [slots, setSlots] = createSignal<Slot[] | null>(null);
	const [pickedSlot, setPickedSlot] = createSignal<string | null>(null);
	const [invitee, setInvitee] = createSignal({
		name: "",
		email: "",
		phone: "",
		notes: "",
	});
	const [confirming, setConfirming] = createSignal(false);
	const [confirmation, setConfirmation] = createSignal<string | null>(null);
	const [error, setError] = createSignal<string | null>(null);

	// Re-load slots whenever the event type changes.
	createEffect(async () => {
		const slug = selectedSlug();
		if (!slug) return;
		setSlots(null);
		setPickedSlot(null);
		try {
			const result = await fetchSlots({
				data: {
					slug,
					from: startOfTomorrow().toISOString(),
					to: plusWeek(startOfTomorrow()).toISOString(),
				},
			});
			setSlots(result);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error");
			setSlots([]);
		}
	});

	async function handleConfirm() {
		const slug = selectedSlug();
		const slot = pickedSlot();
		const data = invitee();
		if (!slug || !slot || !data.email || !data.name) return;
		setConfirming(true);
		setError(null);
		try {
			const result = await confirmBooking({
				data: {
					eventTypeSlug: slug,
					startAt: slot,
					invitee: {
						email: data.email,
						name: data.name,
						phone: data.phone || null,
						timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
					},
					notes: data.notes || null,
				},
			});
			setConfirmation(
				`Booking confirmed (#${result.bookingId.slice(0, 8)}). Check ${data.email} for details.`,
			);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Couldn't confirm.");
		} finally {
			setConfirming(false);
		}
	}

	return (
		<section class="biab-section biab-section--narrow" id="booking">
			<Show
				when={!confirmation()}
				fallback={
					<div class="biab-card booking">
						<span class="biab-badge" style="align-self: flex-start;">
							Booked
						</span>
						<h2 class="biab-section__title">You're on the calendar.</h2>
						<p style="color: var(--text);">{confirmation()}</p>
					</div>
				}
			>
				<div class="biab-section__lead">
					<span class="biab-section__eyebrow">Schedule</span>
					<h2 class="biab-section__title">Book a time</h2>
					<p class="biab-section__sub">
						Pick a slot and we'll send confirmation + a calendar invite.
					</p>
				</div>
				<div class="biab-card booking">
					<Show
						when={props.eventTypes.length > 0}
						fallback={
							<div class="biab-empty">
								No event types configured yet. Add one in BIAB at Dashboard →
								Scheduling → Event Types.
							</div>
						}
					>
						<div>
							<label class="biab-label" for="event-type">
								What for?
							</label>
							<select
								class="biab-select"
								id="event-type"
								onChange={(e) => setSelectedSlug(e.currentTarget.value)}
								value={selectedSlug()}
							>
								<For each={props.eventTypes}>
									{(ev) => (
										<option value={ev.slug}>
											{`${ev.name} · ${ev.durationMinutes}min`}
										</option>
									)}
								</For>
							</select>
						</div>

						<div>
							<div class="biab-label">Next available slots</div>
							<Show
								when={slots() !== null}
								fallback={
									<div class="biab-loading">Computing availability…</div>
								}
							>
								<Show
									when={(slots() ?? []).length > 0}
									fallback={
										<div class="biab-empty">
											No availability in the next week. Try another event type.
										</div>
									}
								>
									<div class="booking__row">
										<For each={(slots() ?? []).slice(0, 12)}>
											{(slot) => (
												<button
													aria-pressed={pickedSlot() === slot.startAt}
													class="slot-button"
													onClick={() => setPickedSlot(slot.startAt)}
													type="button"
												>
													{formatSlotTime(slot.startAt)}
												</button>
											)}
										</For>
									</div>
								</Show>
							</Show>
						</div>

						<Show when={pickedSlot()}>
							<div class="field-row field-row--cols">
								<div>
									<label class="biab-label" for="booking-name">
										Your name
									</label>
									<input
										autocomplete="name"
										class="biab-input"
										id="booking-name"
										onInput={(e) =>
											setInvitee({ ...invitee(), name: e.currentTarget.value })
										}
										placeholder="Jane Doe"
										value={invitee().name}
									/>
								</div>
								<div>
									<label class="biab-label" for="booking-email">
										Email
									</label>
									<input
										autocomplete="email"
										class="biab-input"
										id="booking-email"
										onInput={(e) =>
											setInvitee({ ...invitee(), email: e.currentTarget.value })
										}
										placeholder="jane@example.com"
										type="email"
										value={invitee().email}
									/>
								</div>
							</div>
							<div>
								<label class="biab-label" for="booking-phone">
									Phone (optional)
								</label>
								<input
									autocomplete="tel"
									class="biab-input"
									id="booking-phone"
									onInput={(e) =>
										setInvitee({ ...invitee(), phone: e.currentTarget.value })
									}
									placeholder="(555) 555-0100"
									type="tel"
									value={invitee().phone}
								/>
							</div>
							<div>
								<label class="biab-label" for="booking-notes">
									Anything we should know?
								</label>
								<textarea
									class="biab-textarea"
									id="booking-notes"
									onInput={(e) =>
										setInvitee({ ...invitee(), notes: e.currentTarget.value })
									}
									placeholder="Optional"
									value={invitee().notes}
								/>
							</div>
							<button
								class="biab-btn"
								disabled={confirming() || !invitee().email || !invitee().name}
								onClick={handleConfirm}
								type="button"
							>
								{confirming()
									? "Confirming…"
									: `Book ${formatSlotTime(pickedSlot() ?? "")}`}
							</button>
						</Show>

						<Show when={error()}>
							<div style="color: var(--danger); background: var(--danger-bg); padding: 0.75rem 1rem; border-radius: 0.5rem; font-size: 0.9rem;">
								{error()}
							</div>
						</Show>
					</Show>
				</div>
			</Show>
		</section>
	);
}
