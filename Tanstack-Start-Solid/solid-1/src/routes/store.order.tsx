// [bd-file:store]
import { createFileRoute, Link } from "@tanstack/solid-router";

import { getOrderStatus } from "../lib/bd-shop-fns";

/**
 * Where Stripe sends the shopper after checkout, with `?session_id=…`. The
 * loader looks the session up on the server (`checkout.getStatus`) and the
 * page says whether the payment is in or still being confirmed.
 */
export const Route = createFileRoute("/store/order")({
	component: Order,
	validateSearch: (search: Record<string, unknown>): { session_id?: string } =>
		typeof search.session_id === "string"
			? { session_id: search.session_id }
			: {},
	loaderDeps: ({ search }) => ({ sessionId: search.session_id ?? null }),
	loader: ({ deps }) => getOrderStatus({ data: { sessionId: deps.sessionId } }),
	head: () => ({ meta: [{ title: "Order" }] }),
});

function Order() {
	const order = Route.useLoaderData();
	const paid = () => order().status === "paid";
	return (
		<main class="bd-section bd-section--narrow">
			<div
				class="bd-card"
				style="padding: 2.5rem; display: flex; flex-direction: column; gap: 1rem; align-items: flex-start;"
			>
				<span class="bd-badge">{paid() ? "Paid" : "Order"}</span>
				<h1 class="bd-section__title">
					{paid() ? "Thank you for your order!" : "Order received"}
				</h1>
				<p>
					{paid()
						? `A receipt is on its way${order().email ? ` to ${order().email}` : ""}.`
						: "We're confirming your payment. You'll get an email shortly."}
				</p>
				<Link class="bd-btn bd-btn--ghost" to="/store">
					Continue shopping
				</Link>
			</div>
		</main>
	);
}
