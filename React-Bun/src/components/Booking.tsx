import { useEffect, useState } from "react";

import {
	bd,
	type SchedulingEventType,
	type SchedulingSlot,
} from "../lib/bd";

/**
 * Calendly-shape end-to-end booking through the SDK:
 *
 *   1. List event types  (Class A — admin config, cached)
 *   2. Pick a date, compute available slots  (uncached, per request)
 *   3. Confirm a booking  (Class B — mutation returns the new
 *      authoritative state including the signed manage/reschedule/
 *      cancel tokens for the consumer to hand to the booker)
 *
 * No external scheduling vendor. Everything's BD-side via the
 * `client.scheduling` resource.
 */

function startOfTomorrow(): Date {
	const d = new Date();
	d.setDate(d.getDate() + 1);
	d.setHours(0, 0, 0, 0);
	return d;
}

function endOfTomorrowWeek(start: Date): Date {
	const d = new Date(start);
	d.setDate(d.getDate() + 7);
	return d;
}

function formatSlotTime(iso: string): string {
	const d = new Date(iso);
	return d.toLocaleString(undefined, {
		weekday: "short",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

export function Booking() {
	const [eventTypes, setEventTypes] = useState<SchedulingEventType[]>([]);
	const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
	const [slots, setSlots] = useState<SchedulingSlot[] | null>(null);
	const [pickedSlot, setPickedSlot] = useState<string | null>(null);
	const [invitee, setInvitee] = useState({
		name: "",
		email: "",
		phone: "",
		notes: "",
	});
	const [confirming, setConfirming] = useState(false);
	const [confirmation, setConfirmation] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		bd.scheduling
			.listEventTypes()
			.then((items) => {
				setEventTypes(items);
				if (items[0]) setSelectedSlug(items[0].slug);
			})
			.catch((err) => setError(err.message));
	}, []);

	useEffect(() => {
		if (!selectedSlug) return;
		const from = startOfTomorrow();
		const to = endOfTomorrowWeek(from);
		setSlots(null);
		setPickedSlot(null);
		bd.scheduling
			.getAvailableSlots(selectedSlug, { from, to })
			.then(setSlots)
			.catch((err) => setError(err.message));
	}, [selectedSlug]);

	async function handleConfirm() {
		if (!selectedSlug || !pickedSlot || !invitee.email || !invitee.name) return;
		setConfirming(true);
		setError(null);
		try {
			const result = await bd.scheduling.confirmBooking({
				eventTypeSlug: selectedSlug,
				startAt: new Date(pickedSlot),
				invitee: {
					email: invitee.email,
					name: invitee.name,
					phone: invitee.phone || null,
					timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
				},
				notes: invitee.notes || null,
			});
			setConfirmation(
				`Booking confirmed (#${result.bookingId.slice(0, 8)}). Check ${invitee.email} for details.`,
			);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Couldn't confirm.");
		} finally {
			setConfirming(false);
		}
	}

	if (confirmation) {
		return (
			<section className="bd-section bd-section--narrow" id="booking">
				<div className="bd-card booking">
					<span className="bd-badge" style={{ alignSelf: "flex-start" }}>
						Booked
					</span>
					<h2 className="bd-section__title">You're on the calendar.</h2>
					<p style={{ color: "var(--text)" }}>{confirmation}</p>
				</div>
			</section>
		);
	}

	return (
		<section className="bd-section bd-section--narrow" id="booking">
			<div className="bd-section__lead">
				<span className="bd-section__eyebrow">Schedule</span>
				<h2 className="bd-section__title">Book a time</h2>
				<p className="bd-section__sub">
					Pick a slot and we'll send confirmation + a calendar invite.
				</p>
			</div>
			<div className="bd-card booking">
				{eventTypes.length === 0 ? (
					<div className="bd-empty">
						No event types configured yet. Add one in BD at Dashboard →
						Scheduling → Event Types.
					</div>
				) : (
					<>
						<div>
							<label className="bd-label" htmlFor="event-type">
								What for?
							</label>
							<select
								className="bd-select"
								id="event-type"
								onChange={(e) => setSelectedSlug(e.target.value)}
								value={selectedSlug ?? ""}
							>
								{eventTypes.map((event) => (
									<option key={event.slug} value={event.slug}>
										{event.name} · {event.durationMinutes}min
									</option>
								))}
							</select>
						</div>

						<div>
							<div className="bd-label">Next available slots</div>
							{slots === null ? (
								<div className="bd-loading">Computing availability…</div>
							) : slots.length === 0 ? (
								<div className="bd-empty">
									No availability in the next week. Try another event type.
								</div>
							) : (
								<div className="booking__row">
									{slots.slice(0, 12).map((slot) => (
										<button
											aria-pressed={pickedSlot === slot.startAt}
											className="slot-button"
											key={slot.startAt}
											onClick={() => setPickedSlot(slot.startAt)}
											type="button"
										>
											{formatSlotTime(slot.startAt)}
										</button>
									))}
								</div>
							)}
						</div>

						{pickedSlot ? (
							<>
								<div className="field-row field-row--cols">
									<div>
										<label className="bd-label" htmlFor="booking-name">
											Your name
										</label>
										<input
											className="bd-input"
											id="booking-name"
											onChange={(e) =>
												setInvitee((s) => ({ ...s, name: e.target.value }))
											}
											placeholder="Jane Doe"
											value={invitee.name}
										/>
									</div>
									<div>
										<label className="bd-label" htmlFor="booking-email">
											Email
										</label>
										<input
											className="bd-input"
											id="booking-email"
											onChange={(e) =>
												setInvitee((s) => ({ ...s, email: e.target.value }))
											}
											placeholder="jane@example.com"
											type="email"
											value={invitee.email}
										/>
									</div>
								</div>
								<div>
									<label className="bd-label" htmlFor="booking-phone">
										Phone (optional)
									</label>
									<input
										className="bd-input"
										id="booking-phone"
										onChange={(e) =>
											setInvitee((s) => ({ ...s, phone: e.target.value }))
										}
										placeholder="(555) 555-0100"
										type="tel"
										value={invitee.phone}
									/>
								</div>
								<div>
									<label className="bd-label" htmlFor="booking-notes">
										Anything we should know?
									</label>
									<textarea
										className="bd-textarea"
										id="booking-notes"
										onChange={(e) =>
											setInvitee((s) => ({ ...s, notes: e.target.value }))
										}
										placeholder="Optional"
										value={invitee.notes}
									/>
								</div>
								<button
									className="bd-btn"
									disabled={
										confirming || !invitee.email || !invitee.name
									}
									onClick={handleConfirm}
									type="button"
								>
									{confirming
										? "Confirming…"
										: `Book ${formatSlotTime(pickedSlot)}`}
								</button>
							</>
						) : null}

						{error ? (
							<div
								style={{
									color: "var(--danger)",
									background: "var(--danger-bg)",
									padding: "0.75rem 1rem",
									borderRadius: "0.5rem",
									fontSize: "0.9rem",
								}}
							>
								{error}
							</div>
						) : null}
					</>
				)}
			</div>
		</section>
	);
}
