import { ChangeDetectionStrategy, Component, OnInit, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { bdApi, type Subscription } from "../lib/bd-api.client";

/**
 * Recurring offerings (memberships / monthly plans) from the BD
 * subscriptions surface. Read-only list here; the actual subscribe-checkout
 * handoff is an org/Stripe step left as a next iteration.
 */
@Component({
	selector: "bd-subscriptions-page",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [RouterLink],
	template: `
		<section class="section">
			<h1 class="section__title">Plans &amp; subscriptions</h1>
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
						</article>
					}
				</div>
			}
			<p class="store-links"><a routerLink="/store">Back to store</a></p>
		</section>
	`,
})
export class SubscriptionsPage implements OnInit {
	readonly items = signal<Subscription[]>([]);
	readonly state = signal<"loading" | "ready">("loading");

	async ngOnInit() {
		const res = await bdApi.subscriptions();
		this.items.set(res?.items ?? []);
		this.state.set("ready");
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
