// [bd-file:subscriptions]
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { bdApi, type Subscription } from "../lib/bd-api.client";
import { StoreNavComponent } from "../sections/store-nav.component";

const SIGN_IN = "/my-account?next=/subscriptions";

/**
 * Recurring offerings (memberships / monthly plans) from the BD
 * subscriptions surface. "Subscribe" hands the signed-in customer to
 * Stripe-hosted checkout; a visitor is offered sign-in first.
 */
@Component({
	selector: "bd-subscriptions-page",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [StoreNavComponent],
	template: `
		<bd-store-nav />
		<section class="section">
			<h1 class="section__title">Plans &amp; subscriptions</h1>
			@if (subscribed) {
				<p class="muted">Thanks for subscribing. Your plan is in <a href="/my-account">your account</a>.</p>
			}
			@if (state() === "loading") {
				<p class="muted">Loading…</p>
			} @else if (items().length === 0) {
				<p class="muted">No subscription plans yet — add them in BD to list them here.</p>
			} @else {
				<div class="grid">
					@for (s of items(); track s.id) {
						<article class="card">
							<h3>{{ s.name }}</h3>
							@if (s.description) {
								<p>{{ s.description }}</p>
							}
							<span class="price">{{ money(s.amountCents) }} / {{ s.interval }}</span>
							@if (signedIn()) {
								<button class="bd-btn" type="button" [disabled]="busyId() === s.id" (click)="subscribe(s.id)">
									{{ busyId() === s.id ? "Working…" : "Subscribe" }}
								</button>
							} @else {
								<a class="bd-btn" [href]="signIn">Sign in to subscribe</a>
							}
						</article>
					}
				</div>
			}
			@if (failed()) {
				<p class="error">Couldn't start checkout. Please try again.</p>
			}
		</section>
	`,
})
export class SubscriptionsPage implements OnInit {
	readonly items = signal<Subscription[]>([]);
	readonly state = signal<"loading" | "ready">("loading");
	readonly signedIn = signal(false);
	readonly busyId = signal<string | null>(null);
	readonly failed = signal(false);
	readonly signIn = SIGN_IN;
	// Stripe sends the customer back with the checkout session id.
	readonly subscribed = inject(ActivatedRoute).snapshot.queryParamMap.has("session_id");

	async ngOnInit() {
		const res = await bdApi.subscriptions();
		this.items.set(res?.items ?? []);
		this.signedIn.set(res?.signedIn ?? false);
		this.state.set("ready");
	}

	/** A plan is the signed-in customer's own; anyone else signs in first. */
	async subscribe(id: string) {
		this.busyId.set(id);
		this.failed.set(false);
		const res = await bdApi.subscribe(id);
		const target = res?.url ?? res?.signIn;
		if (target) {
			window.location.href = target;
			return;
		}
		this.busyId.set(null);
		this.failed.set(true);
	}

	money(cents: number): string {
		const value = (cents ?? 0) / 100;
		try {
			return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value);
		} catch {
			return `$${value.toFixed(2)}`;
		}
	}
}
