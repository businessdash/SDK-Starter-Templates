import { createFileRoute, Link } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";

import { formatMoney, intervalLabel } from "../components/bd/money";
import {
	getSubscriptions,
	startSubscriptionCheckout,
} from "../lib/bd-server-fns";

/**
 * Recurring plans. The loader lists offerings via `subscriptions.list`.
 * "Subscribe" starts a Stripe-hosted subscription checkout and redirects.
 */
export const Route = createFileRoute("/subscriptions")({
	component: Subscriptions,
	loader: () => getSubscriptions(),
});

function Subscriptions() {
	const result = Route.useLoaderData();
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

	async function subscribe(id: string) {
		setBusyId(id);
		setError(null);
		const res = await startSubscriptionCheckout({
			data: { id, origin: window.location.origin },
		});
		setBusyId(null);
		if (res.ok) window.location.href = res.url;
		else setError(res.error);
	}

	return (
		<main>
			<section class="bd-section">
				<div class="bd-section__lead">
					<span class="bd-section__eyebrow">Plans</span>
					<h1 class="bd-section__title">Subscriptions</h1>
					<p class="bd-section__sub">
						Recurring plans billed through Stripe. Cancel anytime.
					</p>
				</div>

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
									<button
										type="button"
										class="bd-btn"
										style="margin-top: 0.5rem;"
										disabled={busyId() === plan.id}
										onClick={() => subscribe(plan.id)}
									>
										{busyId() === plan.id ? "Working…" : "Subscribe"}
									</button>
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

				<div style="margin-top: 2rem;">
					<Link to="/store" class="bd-btn bd-btn--ghost">
						← Back to store
					</Link>
				</div>
			</section>
		</main>
	);
}
