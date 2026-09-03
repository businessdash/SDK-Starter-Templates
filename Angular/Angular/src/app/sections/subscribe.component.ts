import {
	ChangeDetectionStrategy,
	Component,
	input,
	signal,
} from "@angular/core";
import {
	FormControl,
	FormGroup,
	ReactiveFormsModule,
	Validators,
} from "@angular/forms";

import { BD_FOLLOWERS_ENABLED, FollowersService } from "../lib/followers.service";

/**
 * Newsletter signup. Wired to BD followers via the browser-safe publishable
 * token (see `FollowersService`); the SAME component powers the footer and the
 * about-section signups — mirroring DGP's shared `SubscribeStub`.
 *
 * Live-vs-placeholder graceful split:
 *   - publishable token + site id present → live `followers.join(...)`, and
 *   - unset → a "coming soon" placeholder so the page never breaks in an
 *     unconfigured checkout.
 *
 * The component owns its own `FollowersService` instance via `providers` so
 * each placement (footer / about) tracks its own submit state independently
 * while still sharing the singleton's localStorage hint.
 */
@Component({
	selector: "bd-subscribe",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ReactiveFormsModule],
	template: `
		@if (done()) {
			<p class="subscribe__done">{{ doneMessage() }}</p>
		} @else {
			<form class="subscribe" [formGroup]="form" (ngSubmit)="onSubmit()">
				<label [for]="idPrefix() + '-email'">{{ label() }}</label>
				<div class="subscribe__row">
					<input
						class="subscribe__input"
						[id]="idPrefix() + '-email'"
						type="email"
						name="email"
						autocomplete="email"
						formControlName="email"
						[placeholder]="placeholder()"
						[disabled]="submitting()"
						required
					/>
					<button class="bd-btn" type="submit" [disabled]="submitting()">
						{{ submitting() ? "…" : buttonLabel() }}
					</button>
				</div>
				@if (errored()) {
					<p class="error">Couldn't subscribe — please try again.</p>
				}
			</form>
		}
	`,
	styles: `
		.subscribe {
			gap: 0.5rem;
			max-width: 22rem;
		}
		.subscribe label {
			font-size: 0.85rem;
			color: inherit;
		}
		.subscribe__row {
			display: flex;
			gap: 0.5rem;
		}
		.subscribe__input {
			flex: 1;
			min-width: 0;
		}
		.subscribe__done {
			color: #047857;
			font-size: 0.9rem;
			margin: 0;
		}
	`,
	providers: [FollowersService],
})
export class SubscribeComponent {
	/** Field label, e.g. "Get service tips in your inbox". */
	readonly label = input<string>("Subscribe to our newsletter");
	readonly placeholder = input<string>("you@example.com");
	readonly buttonLabel = input<string>("Subscribe");
	/** Unique id prefix so multiple instances don't collide; doubles as the
	 *  follower `source` tag (e.g. "footer" / "about"). */
	readonly idPrefix = input<string>("subscribe");

	readonly submitting = signal(false);
	readonly errored = signal(false);
	readonly done = signal(false);

	readonly form = new FormGroup({
		email: new FormControl("", {
			nonNullable: true,
			validators: [Validators.required, Validators.email],
		}),
	});

	constructor(private readonly followers: FollowersService) {
		// Anonymous "already subscribed" hint — skip straight to the done state.
		if (this.followers.subscribedLocally) this.done.set(true);
	}

	doneMessage(): string {
		return BD_FOLLOWERS_ENABLED
			? "You're subscribed — thanks!"
			: "Thanks — newsletter signup is coming soon.";
	}

	async onSubmit(): Promise<void> {
		if (this.form.invalid || this.submitting()) return;
		const email = this.form.controls.email.value.trim();
		if (!email) return;

		// Placeholder mode (unconfigured): just acknowledge, no network call.
		if (!BD_FOLLOWERS_ENABLED) {
			this.done.set(true);
			return;
		}

		this.submitting.set(true);
		this.errored.set(false);
		try {
			await this.followers.join({ email, source: this.idPrefix() });
			this.done.set(true);
		} catch {
			this.errored.set(true);
		} finally {
			this.submitting.set(false);
		}
	}
}
