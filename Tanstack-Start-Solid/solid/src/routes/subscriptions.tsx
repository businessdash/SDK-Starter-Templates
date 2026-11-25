// [bd-file:subscriptions]
import { createFileRoute } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";

import { formatMoney, intervalLabel } from "../components/bd/money";
import { StoreNav } from "../components/bd/StoreNav";
import {
	getSubscriptions,
	startSubscriptionCheckout,
} from "../lib/bd-server-fns";
// [bd:store]
import { getCartCount } from "../lib/bd-shop-fns";
// [/bd:store]

/**
 * Recurring plans. The loader lists offerings via `subscriptions.list`.
 * "Subscribe" starts a Stripe-hosted subscription checkout and redirects.
 */
export const Route = createFileRoute("/subscriptions")({
	component: Subscriptions,
	// Stripe sends the customer back with the checkout session id.
	validateSearch: (search: Record<string, unknown>): { session_id?: string } =>
		typeof search.session_id === "string"
			? { session_id: search.session_id }
			: {},
	loader: async () => {
		// [bd:store]
		const cartCount = getCartCount();
		// [/bd:store]
		return {
			plans: await getSubscriptions(),
			// [bd:store]
			cartCount: await cartCount,
			// [/bd:store]
		};
	},
});

const SIGN_IN = "/my-account?next=/subscriptions";

function Subscriptions() {
	const loaded = Route.useLoaderData();
	const result = () => loaded().plans;
	const [busyId, setBusyId] = createSignal<string | null>(null);
	const [error, setError] = createSignal<string | null>(null);
	const items = () => {
		const r = result();
		return r.ok ? r.items : [];
	};
	const reason = () => {
		const r = result();
		return r.ok ? null : r.reason;
	};
	const signedIn = () => {
		const r = result();
		return r.ok && r.signedIn;
	};
	const search = Route.useSearch();

	async function subscribe(id: string) {
		setBusyId(id);
		setError(null);
		const res = await startSubscriptionCheckout({
			data: { id, origin: window.location.origin },
		});
		setBusyId(null);
		if (res.ok) window.location.href = res.url;
		else if (res.signIn) window.location.href = res.signIn;
		else setError(res.error);
	}

	return (
		<>
			{/* [bd:store] */}
			<StoreNav cartCount={loaded().cartCount} />
			{/* [/bd:store] */}
			{/* [bd:!store] */}
			<StoreNav />
			{/* [/bd:!store] */}
			<main>
				<section class="bd-section">
					<div class="bd-section__lead">
						<span class="bd-section__eyebrow">Plans</span>
						<h1 class="bd-section__title">Subscriptions</h1>
						<p class="bd-section__sub">
							Recurring plans billed through Stripe. Cancel anytime.
						</p>
					</div>

					<Show when={search().session_id}>
						<div class="bd-empty">
							Thanks for subscribing. Your plan is in{" "}
							<a href="/my-account">your account</a>.
						</div>
					</Show>

					<Show
						when={result().ok && items().length > 0}
						fallback={
							<div class="bd-empty">
								<Show
									when={reason() === "suspended"}
									fallback={
										<Show
											when={reason() === "unconfigured"}
											fallback={<>No subscription plans published yet.</>}
										>
											Subscriptions aren't connected yet (missing BD env).
										</Show>
									}
								>
									Subscriptions are temporarily unavailable.
								</Show>
							</div>
						}
					>
						<div class="bd-grid-3">
							<For each={items()}>
								{(plan) => (
									<article class="bd-card service-card">
										<Show when={plan.imageUrl}>
											<img
												src={plan.imageUrl ?? ""}
												alt={plan.name}
												style="aspect-ratio: 4/3; object-fit: cover; border-radius: 0.6rem;"
											/>
										</Show>
										<h3>{plan.name}</h3>
										<Show when={plan.description}>
											<p>{plan.description}</p>
										</Show>
										<div class="service-card__price">
											{formatMoney(plan.amountCents)} /{" "}
											{intervalLabel(plan.interval)}
										</div>
										<Show
											when={signedIn()}
											fallback={
												<a
													class="bd-btn"
													style="margin-top: 0.5rem;"
													href={SIGN_IN}
												>
													Sign in to subscribe
												</a>
											}
										>
											<button
												type="button"
												class="bd-btn"
												style="margin-top: 0.5rem;"
												disabled={busyId() === plan.id}
												onClick={() => subscribe(plan.id)}
											>
												{busyId() === plan.id ? "Working…" : "Subscribe"}
											</button>
										</Show>
									</article>
								)}
							</For>
						</div>
					</Show>

					<Show when={error()}>
						<div style="margin-top: 1.5rem; color: var(--danger); background: var(--danger-bg); padding: 0.75rem 1rem; border-radius: 0.5rem; font-size: 0.9rem;">
							{error()}
						</div>
					</Show>
				</section>
			</main>
		</>
	);
}
