import { bd, el, empty } from "../bd.js";

/**
 * Calendly-shape end-to-end booking flow:
 *   listEventTypes → getAvailableSlots → confirmBooking.
 *
 * Local state lives in a closure object on the rendered section
 * — no framework, no signals, just a `state` + `rerender()` pair
 * that matches what the React-Bun version does with `useState`.
 *
 * @param {HTMLElement} target
 */
export async function renderBooking(target) {
	const state = {
		eventTypes: [],
		selectedSlug: null,
		slots: null,
		pickedSlot: null,
		invitee: { name: "", email: "", phone: "", notes: "" },
		confirming: false,
		confirmation: null,
		error: null,
	};

	function tz() {
		return Intl.DateTimeFormat().resolvedOptions().timeZone;
	}
	function startOfTomorrow() {
		const d = new Date();
		d.setDate(d.getDate() + 1);
		d.setHours(0, 0, 0, 0);
		return d;
	}
	function plusWeek(d) {
		const next = new Date(d);
		next.setDate(next.getDate() + 7);
		return next;
	}
	function formatSlotTime(iso) {
		const d = new Date(iso);
		return d.toLocaleString(undefined, {
			weekday: "short",
			month: "short",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
		});
	}

	async function loadSlots(slug) {
		state.slots = null;
		state.pickedSlot = null;
		rerender();
		try {
			state.slots = await bd.scheduling.getAvailableSlots(slug, {
				from: startOfTomorrow(),
				to: plusWeek(startOfTomorrow()),
			});
		} catch (err) {
			state.error = err instanceof Error ? err.message : "Unknown error";
		}
		rerender();
	}

	async function handleConfirm() {
		if (
			!state.selectedSlug ||
			!state.pickedSlot ||
			!state.invitee.email ||
			!state.invitee.name
		)
			return;
		state.confirming = true;
		state.error = null;
		rerender();
		try {
			const result = await bd.scheduling.confirmBooking({
				eventTypeSlug: state.selectedSlug,
				startAt: new Date(state.pickedSlot),
				invitee: {
					email: state.invitee.email,
					name: state.invitee.name,
					phone: state.invitee.phone || null,
					timezone: tz(),
				},
				notes: state.invitee.notes || null,
			});
			state.confirmation = `Booking confirmed (#${result.bookingId.slice(0, 8)}). Check ${state.invitee.email} for details.`;
		} catch (err) {
			state.error = err instanceof Error ? err.message : "Couldn't confirm.";
		} finally {
			state.confirming = false;
			rerender();
		}
	}

	function rerender() {
		const lead = el("div", { class: "bd-section__lead" }, [
			el("span", { class: "bd-section__eyebrow" }, ["Schedule"]),
			el("h2", { class: "bd-section__title" }, ["Book a time"]),
			el("p", { class: "bd-section__sub" }, [
				"Pick a slot and we'll send confirmation + a calendar invite.",
			]),
		]);

		if (state.confirmation) {
			target.replaceChildren(
				el("div", { class: "bd-card booking" }, [
					el("span", { class: "bd-badge", style: "align-self: flex-start;" }, [
						"Booked",
					]),
					el("h2", { class: "bd-section__title" }, ["You're on the calendar."]),
					el("p", { style: "color: var(--text);" }, [state.confirmation]),
				]),
			);
			return;
		}

		if (state.eventTypes.length === 0) {
			target.replaceChildren(
				lead,
				el("div", { class: "bd-card booking" }, [
					empty(
						"No event types configured yet. Add one in BD at Dashboard → Scheduling → Event Types.",
					),
				]),
			);
			return;
		}

		const eventSelect = el(
			"select",
			{
				class: "bd-select",
				id: "event-type",
				onChange: (e) => {
					state.selectedSlug = e.currentTarget.value;
					loadSlots(state.selectedSlug);
				},
			},
			state.eventTypes.map((ev) =>
				el(
					"option",
					{
						value: ev.slug,
						selected: ev.slug === state.selectedSlug,
					},
					[`${ev.name} · ${ev.durationMinutes}min`],
				),
			),
		);

		const slotsBlock = (() => {
			if (state.slots === null) {
				return el("div", { class: "bd-loading" }, ["Computing availability…"]);
			}
			if (state.slots.length === 0) {
				return empty(
					"No availability in the next week. Try another event type.",
				);
			}
			return el(
				"div",
				{ class: "booking__row" },
				state.slots.slice(0, 12).map((slot) =>
					el(
						"button",
						{
							type: "button",
							class: "slot-button",
							"aria-pressed": state.pickedSlot === slot.startAt,
							onClick: () => {
								state.pickedSlot = slot.startAt;
								rerender();
							},
						},
						[formatSlotTime(slot.startAt)],
					),
				),
			);
		})();

		const inviteeBlock = state.pickedSlot
			? [
					el("div", { class: "field-row field-row--cols" }, [
						el("div", {}, [
							el("label", { class: "bd-label", for: "booking-name" }, [
								"Your name",
							]),
							el("input", {
								class: "bd-input",
								id: "booking-name",
								placeholder: "Jane Doe",
								value: state.invitee.name,
								onInput: (e) => {
									state.invitee.name = e.currentTarget.value;
								},
							}),
						]),
						el("div", {}, [
							el("label", { class: "bd-label", for: "booking-email" }, [
								"Email",
							]),
							el("input", {
								class: "bd-input",
								id: "booking-email",
								type: "email",
								placeholder: "jane@example.com",
								value: state.invitee.email,
								onInput: (e) => {
									state.invitee.email = e.currentTarget.value;
								},
							}),
						]),
					]),
					el("div", {}, [
						el("label", { class: "bd-label", for: "booking-phone" }, [
							"Phone (optional)",
						]),
						el("input", {
							class: "bd-input",
							id: "booking-phone",
							type: "tel",
							placeholder: "(555) 555-0100",
							value: state.invitee.phone,
							onInput: (e) => {
								state.invitee.phone = e.currentTarget.value;
							},
						}),
					]),
					el("div", {}, [
						el("label", { class: "bd-label", for: "booking-notes" }, [
							"Anything we should know?",
						]),
						el("textarea", {
							class: "bd-textarea",
							id: "booking-notes",
							placeholder: "Optional",
							value: state.invitee.notes,
							onInput: (e) => {
								state.invitee.notes = e.currentTarget.value;
							},
						}),
					]),
					el(
						"button",
						{
							type: "button",
							class: "bd-btn",
							disabled:
								state.confirming || !state.invitee.email || !state.invitee.name,
							onClick: handleConfirm,
						},
						[
							state.confirming
								? "Confirming…"
								: `Book ${formatSlotTime(state.pickedSlot)}`,
						],
					),
				]
			: [];

		const errorBlock = state.error
			? el(
					"div",
					{
						style:
							"color: var(--danger); background: var(--danger-bg); padding: 0.75rem 1rem; border-radius: 0.5rem; font-size: 0.9rem;",
					},
					[state.error],
				)
			: null;

		target.replaceChildren(
			lead,
			el("div", { class: "bd-card booking" }, [
				el("div", {}, [
					el("label", { class: "bd-label", for: "event-type" }, ["What for?"]),
					eventSelect,
				]),
				el("div", {}, [
					el("div", { class: "bd-label" }, ["Next available slots"]),
					slotsBlock,
				]),
				...inviteeBlock,
				errorBlock,
			]),
		);
	}

	try {
		state.eventTypes = await bd.scheduling.listEventTypes();
		if (state.eventTypes[0]) {
			state.selectedSlug = state.eventTypes[0].slug;
			rerender();
			await loadSlots(state.selectedSlug);
		} else {
			rerender();
		}
	} catch (err) {
		state.error = err instanceof Error ? err.message : "Unknown error";
		rerender();
	}
}
