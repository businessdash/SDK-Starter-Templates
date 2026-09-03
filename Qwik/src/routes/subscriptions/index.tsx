import { $, component$, useSignal } from "@builder.io/qwik";
import { type DocumentHead, routeLoader$, server$ } from "@builder.io/qwik-city";

import {
	BdPaymentLapsedError,
	BdServiceSuspendedError,
} from "@businessdash/sdk";
import type { SubscriptionOffering } from "@businessdash/sdk/contracts";

import { Footer } from "../../components/bd/Footer";
import { SiteHeader } from "../../components/bd/SiteHeader";
import { getBd } from "../../lib/bd";
import { formatMoney } from "../../lib/bd-store";
import { getCustomerSession } from "../../lib/bd-portal";

/** Subscription offerings list. Each plan starts its own Stripe checkout. */
export const useSubscriptions = routeLoader$(async ({ cookie }) => {
	const bd = getBd();
	if (!bd) {
		return { configured: false, suspended: false, items: [], signedIn: false } as const;
	}
	try {
		const [res, session] = await Promise.all([
			bd.subscriptions.list(),
			getCustomerSession(cookie),
		]);
		return {
			configured: true,
			suspended: false,
			items: res.items,
			signedIn: !!session,
		} as const;
	} catch (err) {
		if (
			err instanceof BdServiceSuspendedError ||
			err instanceof BdPaymentLapsedError
		) {
			return { configured: true, suspended: true, items: [], signedIn: false } as const;
		}
		return { configured: true, suspended: false, items: [], signedIn: false } as const;
	}
});

const startSubscriptionRpc = server$(async function (this, id: string) {
	const bd = getBd();
	if (!bd) return { ok: false as const, error: "Plans aren't connected." };
	try {
		const res = await bd.subscriptions.startCheckout(id, {
			successUrl: `${this.url.origin}/store/order?session_id={CHECKOUT_SESSION_ID}`,
			cancelUrl: `${this.url.origin}/subscriptions`,
		});
		return { ok: true as const, url: res.stripeUrl };
	} catch (err) {
		return {
			ok: false as const,
			error: err instanceof Error ? err.message : "Couldn't start checkout.",
		};
	}
});

export default component$(() => {
	const data = useSubscriptions();
	const busy = useSignal<string | null>(null);
	const error = useSignal<string | null>(null);

	const subscribe = $(async (id: string) => {
		busy.value = id;
		error.value = null;
		const res = await startSubscriptionRpc(id);
		busy.value = null;
		if (res.ok) window.location.href = res.url;
		else error.value = res.error;
	});

	const items = data.value.items as SubscriptionOffering[];

	return (
		<>
			<SiteHeader signedIn={data.value.signedIn} />
			<main>
				<section class="bd-section">
					<div class="bd-section__lead">
						<span class="bd-section__eyebrow">Memberships</span>
						<h2 class="bd-section__title">Plans</h2>
						<p class="bd-section__sub">
							Recurring offerings from the BD subscriptions surface. Each
							subscribe button opens Stripe-hosted checkout.
						</p>
					</div>

					{data.value.suspended ? (
						<div class="bd-empty">
							Plans are temporarily unavailable. Please check back soon.
						</div>
					) : items.length === 0 ? (
						<div class="bd-empty">
							No subscription plans yet. Add some in BD at Dashboard →
							Products → Subscriptions.
						</div>
					) : (
						<div class="bd-grid-3">
							{items.map((plan) => (
								<div
									class="bd-card service-card"
									key={plan.id}
								>
									{plan.imageUrl ? (
										<img
											alt={plan.name}
											src={plan.imageUrl}
											style="border-radius: 0.75rem; aspect-ratio: 4/3; object-fit: cover;"
										/>
									) : null}
									<h3>{plan.name}</h3>
									{plan.description ? <p>{plan.description}</p> : null}
									<div class="service-card__price">
										{formatMoney(plan.amountCents, "usd")} / {plan.interval}
									</div>
									<button
										class="bd-btn"
										disabled={busy.value === plan.id}
										onClick$={() => subscribe(plan.id)}
										style="align-self: flex-start; margin-top: 0.5rem;"
										type="button"
									>
										{busy.value === plan.id ? "Working…" : "Subscribe"}
									</button>
								</div>
							))}
						</div>
					)}

					{error.value ? (
						<div style="color: var(--danger); background: var(--danger-bg); padding: 0.75rem 1rem; border-radius: 0.5rem; margin-top: 1.5rem;">
							{error.value}
						</div>
					) : null}
				</section>
			</main>
			<Footer />
		</>
	);
});

export const head: DocumentHead = {
	title: "Plans — Your Business",
	meta: [
		{ name: "description", content: "Recurring subscription plans via Stripe." },
	],
};
