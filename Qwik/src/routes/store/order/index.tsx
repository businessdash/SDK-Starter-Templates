import { component$ } from "@builder.io/qwik";
import { type DocumentHead, routeLoader$ } from "@builder.io/qwik-city";

import { Footer } from "../../../components/bd/Footer";
import { SiteHeader } from "../../../components/bd/SiteHeader";
import { getBd } from "../../../lib/bd";
import { getCustomerSession } from "../../../lib/bd-portal";

/**
 * Stripe checkout return page. Stripe sends the shopper here with
 * `?session_id=…`; we look the session up server-side via
 * `checkout.getStatus(sessionId)` and render a paid / pending confirmation.
 */
export const useOrder = routeLoader$(async ({ query, cookie }) => {
	const sessionId = query.get("session_id");
	const session = await getCustomerSession(cookie);
	const bd = getBd();
	if (!bd || !sessionId) {
		return { status: null, email: null, signedIn: !!session };
	}
	try {
		const res = await bd.checkout.getStatus(sessionId);
		return {
			status: res.paymentStatus,
			email: res.customerEmail,
			signedIn: !!session,
		};
	} catch {
		return { status: null, email: null, signedIn: !!session };
	}
});

export default component$(() => {
	const data = useOrder();
	const paid = data.value.status === "paid";

	return (
		<>
			<SiteHeader signedIn={data.value.signedIn} />
			<main>
				<section class="bd-section bd-section--narrow">
					<div class="bd-card" style="padding: 2.5rem; display: flex; flex-direction: column; gap: 1rem; align-items: flex-start;">
						<span class="bd-badge">{paid ? "Paid" : "Order"}</span>
						<h1 class="bd-section__title">
							{paid ? "Thank you for your order!" : "Order received"}
						</h1>
						<p>
							{paid
								? `A receipt is on its way${data.value.email ? ` to ${data.value.email}` : ""}.`
								: "We're confirming your payment. You'll get an email shortly."}
						</p>
						<a class="bd-btn bd-btn--ghost" href="/store">
							Continue shopping
						</a>
					</div>
				</section>
			</main>
			<Footer />
		</>
	);
});

export const head: DocumentHead = {
	title: "Order — Your Business",
	meta: [{ name: "description", content: "Order confirmation." }],
};
