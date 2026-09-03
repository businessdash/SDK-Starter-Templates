<script lang="ts">
	/**
	 * Booking — server-rendered event-type list + client-side slot
	 * picker and confirm. Uses Svelte 5 runes for reactive state.
	 *
	 * Slot loads + booking confirms go through `+server.ts` endpoints
	 * under `/api/bd/scheduling/*` — secrets stay on the server.
	 */
	type EventType = {
		id: string;
		name: string;
		slug: string;
		durationMinutes: number;
	};
	type Slot = { startAt: string; endAt: string };

	let { eventTypes }: { eventTypes: EventType[] } = $props();

	let selectedSlug = $state<string | null>(null);
	let slots = $state<Slot[] | null>(null);
	let pickedSlot = $state<string | null>(null);
	let invitee = $state({ name: '', email: '', phone: '', notes: '' });
	let confirming = $state(false);
	let confirmation = $state<string | null>(null);
	let error = $state<string | null>(null);

	// Initialise the dropdown from props inside an effect so prop
	// updates flow through. Svelte 5 warns if you read a prop directly
	// in a `$state(...)` initialiser because the value is captured at
	// init and won't update if the parent re-renders.
	$effect(() => {
		if (selectedSlug === null && eventTypes[0]) {
			selectedSlug = eventTypes[0].slug;
		}
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
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
		});
	}

	async function loadSlots(slug: string) {
		slots = null;
		pickedSlot = null;
		const from = startOfTomorrow();
		const to = plusWeek(from);
		const params = new URLSearchParams({
			slug,
			from: from.toISOString(),
			to: to.toISOString(),
		});
		try {
			const res = await fetch(`/api/bd/scheduling/slots?${params}`);
			if (!res.ok) throw new Error(await res.text());
			const data = (await res.json()) as { slots: Slot[] };
			slots = data.slots;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unknown error';
			slots = [];
		}
	}

	async function handleConfirm() {
		if (!selectedSlug || !pickedSlot || !invitee.email || !invitee.name) return;
		confirming = true;
		error = null;
		try {
			const res = await fetch('/api/bd/scheduling/bookings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					eventTypeSlug: selectedSlug,
					startAt: pickedSlot,
					invitee: {
						email: invitee.email,
						name: invitee.name,
						phone: invitee.phone || null,
						timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
					},
					notes: invitee.notes || null,
				}),
			});
			if (!res.ok) throw new Error(await res.text());
			const result = (await res.json()) as { bookingId: string };
			confirmation = `Booking confirmed (#${result.bookingId.slice(0, 8)}). Check ${invitee.email} for details.`;
		} catch (err) {
			error = err instanceof Error ? err.message : "Couldn't confirm.";
		} finally {
			confirming = false;
		}
	}

	// Kick off the first slot load once the component mounts.
	$effect(() => {
		if (selectedSlug) loadSlots(selectedSlug);
	});
</script>

<section class="bd-section bd-section--narrow" id="booking">
	{#if confirmation}
		<div class="bd-card booking">
			<span class="bd-badge" style="align-self: flex-start;">Booked</span>
			<h2 class="bd-section__title">You're on the calendar.</h2>
			<p style="color: var(--text);">{confirmation}</p>
		</div>
	{:else}
		<div class="bd-section__lead">
			<span class="bd-section__eyebrow">Schedule</span>
			<h2 class="bd-section__title">Book a time</h2>
			<p class="bd-section__sub">
				Pick a slot and we'll send confirmation + a calendar invite.
			</p>
		</div>
		<div class="bd-card booking">
			{#if eventTypes.length === 0}
				<div class="bd-empty">
					No event types configured yet. Add one in BD at Dashboard →
					Scheduling → Event Types.
				</div>
			{:else}
				<div>
					<label class="bd-label" for="event-type">What for?</label>
					<select
						class="bd-select"
						id="event-type"
						bind:value={selectedSlug}
					>
						{#each eventTypes as event (event.slug)}
							<option value={event.slug}>
								{event.name} · {event.durationMinutes}min
							</option>
						{/each}
					</select>
				</div>

				<div>
					<div class="bd-label">Next available slots</div>
					{#if slots === null}
						<div class="bd-loading">Computing availability…</div>
					{:else if slots.length === 0}
						<div class="bd-empty">
							No availability in the next week. Try another event type.
						</div>
					{:else}
						<div class="booking__row">
							{#each slots.slice(0, 12) as slot (slot.startAt)}
								<button
									type="button"
									class="slot-button"
									aria-pressed={pickedSlot === slot.startAt}
									onclick={() => (pickedSlot = slot.startAt)}
								>
									{formatSlotTime(slot.startAt)}
								</button>
							{/each}
						</div>
					{/if}
				</div>

				{#if pickedSlot}
					<div class="field-row field-row--cols">
						<div>
							<label class="bd-label" for="booking-name">Your name</label>
							<input
								class="bd-input"
								id="booking-name"
								bind:value={invitee.name}
								placeholder="Jane Doe"
							/>
						</div>
						<div>
							<label class="bd-label" for="booking-email">Email</label>
							<input
								class="bd-input"
								id="booking-email"
								type="email"
								bind:value={invitee.email}
								placeholder="jane@example.com"
							/>
						</div>
					</div>
					<div>
						<label class="bd-label" for="booking-phone"
							>Phone (optional)</label
						>
						<input
							class="bd-input"
							id="booking-phone"
							type="tel"
							bind:value={invitee.phone}
							placeholder="(555) 555-0100"
						/>
					</div>
					<div>
						<label class="bd-label" for="booking-notes"
							>Anything we should know?</label
						>
						<textarea
							class="bd-textarea"
							id="booking-notes"
							bind:value={invitee.notes}
							placeholder="Optional"
						></textarea>
					</div>
					<button
						type="button"
						class="bd-btn"
						disabled={confirming || !invitee.email || !invitee.name}
						onclick={handleConfirm}
					>
						{confirming
							? 'Confirming…'
							: `Book ${formatSlotTime(pickedSlot)}`}
					</button>
				{/if}

				{#if error}
					<div
						style="color: var(--danger); background: var(--danger-bg); padding: 0.75rem 1rem; border-radius: 0.5rem; font-size: 0.9rem;"
					>
						{error}
					</div>
				{/if}
			{/if}
		</div>
	{/if}
</section>
