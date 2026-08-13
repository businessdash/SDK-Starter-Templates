import { ChangeDetectionStrategy, Component, OnInit, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { biabApi, type EventType, type Slot } from "../lib/biab-api.client";

/**
 * Booking / scheduling. Lists the org's event types, fetches available slots
 * for the chosen one, and confirms a booking (reactive form) through the
 * server `/api/biab/scheduling/*` endpoints. Times are handled as ISO strings
 * across the wire; the visitor's timezone is sent so the server books in the
 * right zone.
 */
@Component({
	selector: "biab-booking-page",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ReactiveFormsModule, RouterLink],
	template: `
		<section class="section">
			<h1 class="section__title">Book an appointment</h1>

			@if (state() === "loading") {
				<p class="muted">Loading…</p>
			} @else if (eventTypes().length === 0) {
				<p class="muted">No bookable services yet — set up scheduling in BIAB to enable booking.</p>
			} @else if (confirmed()) {
				<p class="muted">You're booked! We'll email you the details.</p>
			} @else {
				<label class="booking-select">
					Service
					<select (change)="selectEvent($any($event.target).value)">
						<option value="">Choose…</option>
						@for (e of eventTypes(); track e.slug) {
							<option [value]="e.slug">{{ e.name }} ({{ e.durationMinutes }} min)</option>
						}
					</select>
				</label>

				@if (selectedSlug()) {
					<h2 class="section__subtitle">Pick a time</h2>
					@if (slots().length === 0) {
						<p class="muted">No open times in the next two weeks.</p>
					} @else {
						<div class="slot-grid">
							@for (s of slots(); track s.startAt) {
								<button
									type="button"
									class="slot"
									[class.slot--active]="chosenStart() === s.startAt"
									(click)="chooseSlot(s)"
								>
									{{ slotLabel(s) }}
								</button>
							}
						</div>
					}
				}

				@if (chosenStart()) {
					<form [formGroup]="form" (ngSubmit)="confirm()">
						<label>Name<input formControlName="name" autocomplete="name" /></label>
						<label>Email<input formControlName="email" type="email" autocomplete="email" /></label>
						<label>Phone (optional)<input formControlName="phone" autocomplete="tel" /></label>
						<button class="biab-btn" type="submit" [disabled]="form.invalid || booking()">
							{{ booking() ? "Booking…" : "Confirm booking" }}
						</button>
						@if (errorMsg()) {
							<p class="error">{{ errorMsg() }}</p>
						}
					</form>
				}
			}
			<p class="store-links"><a routerLink="/">Back home</a></p>
		</section>
	`,
})
export class BookingPage implements OnInit {
	readonly eventTypes = signal<EventType[]>([]);
	readonly state = signal<"loading" | "ready">("loading");
	readonly selectedSlug = signal<string | null>(null);
	readonly slots = signal<Slot[]>([]);
	readonly chosenStart = signal<string | null>(null);
	readonly booking = signal(false);
	readonly confirmed = signal(false);
	readonly errorMsg = signal<string | null>(null);

	readonly form = new FormGroup({
		name: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
		email: new FormControl("", { nonNullable: true, validators: [Validators.required, Validators.email] }),
		phone: new FormControl("", { nonNullable: true }),
	});

	async ngOnInit() {
		const res = await biabApi.eventTypes();
		this.eventTypes.set(res?.items ?? []);
		this.state.set("ready");
	}

	async selectEvent(slug: string) {
		this.selectedSlug.set(slug || null);
		this.chosenStart.set(null);
		this.slots.set([]);
		if (!slug) return;
		const from = new Date().toISOString();
		const to = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
		const res = await biabApi.slots(slug, from, to);
		this.slots.set(res?.slots ?? []);
	}

	chooseSlot(s: Slot) {
		this.chosenStart.set(s.startAt);
	}

	slotLabel(s: Slot): string {
		const d = new Date(s.startAt);
		return d.toLocaleString(undefined, {
			weekday: "short",
			month: "short",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
		});
	}

	async confirm() {
		const slug = this.selectedSlug();
		const start = this.chosenStart();
		if (!slug || !start || this.form.invalid) return;
		this.booking.set(true);
		this.errorMsg.set(null);
		const { name, email, phone } = this.form.getRawValue();
		const res = await biabApi.book(slug, {
			startAt: start,
			name,
			email,
			...(phone ? { phone } : {}),
			timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		});
		this.booking.set(false);
		if (res?.ok) this.confirmed.set(true);
		else this.errorMsg.set("Couldn't complete the booking. Please try another time.");
	}
}
