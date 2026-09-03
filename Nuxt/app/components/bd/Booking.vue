<script setup lang="ts">
import { ref, watch } from "vue";

import type { EventType } from "../../../server/api/bd/home.get";

type Slot = { startAt: string; endAt: string };

const props = defineProps<{ eventTypes: EventType[] }>();

const selectedSlug = ref<string>(props.eventTypes[0]?.slug ?? "");
const slots = ref<Slot[] | null>(null);
const pickedSlot = ref<string | null>(null);
const inviteeName = ref("");
const inviteeEmail = ref("");
const inviteePhone = ref("");
const inviteeNotes = ref("");
const confirming = ref(false);
const confirmation = ref<string | null>(null);
const error = ref<string | null>(null);

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

// Re-load slots whenever the selected event type changes.
watch(
	selectedSlug,
	async (slug) => {
		if (!slug) return;
		slots.value = null;
		pickedSlot.value = null;
		try {
			const from = startOfTomorrow().toISOString();
			const to = plusWeek(startOfTomorrow()).toISOString();
			const result = await $fetch<{ slots: Slot[] }>(
				"/api/bd/scheduling/slots",
				{ params: { slug, from, to } },
			);
			slots.value = result.slots;
		} catch (err) {
			error.value = err instanceof Error ? err.message : "Unknown error";
			slots.value = [];
		}
	},
	{ immediate: true },
);

async function handleConfirm() {
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
		const result = await $fetch<{ bookingId: string }>(
			"/api/bd/scheduling/bookings",
			{
				method: "POST",
				body: {
					eventTypeSlug: selectedSlug.value,
					startAt: pickedSlot.value,
					invitee: {
						email: inviteeEmail.value,
						name: inviteeName.value,
						phone: inviteePhone.value || null,
						timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
					},
					notes: inviteeNotes.value || null,
				},
			},
		);
		confirmation.value = `Booking confirmed (#${result.bookingId.slice(0, 8)}). Check ${inviteeEmail.value} for details.`;
	} catch (err) {
		error.value = err instanceof Error ? err.message : "Couldn't confirm.";
	} finally {
		confirming.value = false;
	}
}
</script>

<template>
	<section class="bd-section bd-section--narrow" id="booking">
		<template v-if="confirmation">
			<div class="bd-card booking">
				<span class="bd-badge" style="align-self: flex-start;">Booked</span>
				<h2 class="bd-section__title">You're on the calendar.</h2>
				<p style="color: var(--text);">{{ confirmation }}</p>
			</div>
		</template>

		<template v-else>
			<div class="bd-section__lead">
				<span class="bd-section__eyebrow">Schedule</span>
				<h2 class="bd-section__title">Book a time</h2>
				<p class="bd-section__sub">
					Pick a slot and we'll send confirmation + a calendar invite.
				</p>
			</div>

			<div class="bd-card booking">
				<div v-if="eventTypes.length === 0" class="bd-empty">
					No event types configured yet. Add one in BD at Dashboard →
					Scheduling → Event Types.
				</div>
				<template v-else>
					<div>
						<label class="bd-label" for="event-type">What for?</label>
						<select
							v-model="selectedSlug"
							class="bd-select"
							id="event-type"
						>
							<option
								v-for="ev in eventTypes"
								:key="ev.slug"
								:value="ev.slug"
							>
								{{ `${ev.name} · ${ev.durationMinutes}min` }}
							</option>
						</select>
					</div>

					<div>
						<div class="bd-label">Next available slots</div>
						<div v-if="slots === null" class="bd-loading">
							Computing availability…
						</div>
						<div v-else-if="slots.length === 0" class="bd-empty">
							No availability in the next week. Try another event type.
						</div>
						<div v-else class="booking__row">
							<button
								v-for="slot in slots.slice(0, 12)"
								:key="slot.startAt"
								:aria-pressed="pickedSlot === slot.startAt"
								class="slot-button"
								type="button"
								@click="pickedSlot = slot.startAt"
							>
								{{ formatSlotTime(slot.startAt) }}
							</button>
						</div>
					</div>

					<template v-if="pickedSlot">
						<div class="field-row field-row--cols">
							<div>
								<label class="bd-label" for="booking-name">Your name</label>
								<input
									v-model="inviteeName"
									class="bd-input"
									id="booking-name"
									placeholder="Jane Doe"
								/>
							</div>
							<div>
								<label class="bd-label" for="booking-email">Email</label>
								<input
									v-model="inviteeEmail"
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
								v-model="inviteePhone"
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
								v-model="inviteeNotes"
								class="bd-textarea"
								id="booking-notes"
								placeholder="Optional"
							></textarea>
						</div>
						<button
							:disabled="confirming || !inviteeEmail || !inviteeName"
							class="bd-btn"
							type="button"
							@click="handleConfirm"
						>
							{{
								confirming
									? "Confirming…"
									: `Book ${formatSlotTime(pickedSlot)}`
							}}
						</button>
					</template>

					<div
						v-if="error"
						style="color: var(--danger); background: var(--danger-bg); padding: 0.75rem 1rem; border-radius: 0.5rem; font-size: 0.9rem;"
					>
						{{ error }}
					</div>
				</template>
			</div>
		</template>
	</section>
</template>
