import Link from "next/link";

import { getCheckoutStatus } from "@/server/lib/bd-store";

import { Notice } from "../_components/Notice";
import { usd } from "../_components/store-utils";

export const dynamic = "force-dynamic";

/**
 * Post-checkout return page. Stripe redirects here with `?session_id=…`; we
 * confirm payment via `checkout.getStatus(sessionId)`. The cart is cleared
 * server-side on a paid session, so this just reports the outcome.
 */
export default async function OrderPage({
	searchParams,
}: {
	searchParams: Promise<{ session_id?: string }>;
}) {
	const { session_id } = await searchParams;

	if (!session_id) {
		return (
			<Notice
				body="This page expects a Stripe checkout session id. Start a checkout from your cart."
				title="No order to show"
			/>
		);
	}

	const status = await getCheckoutStatus(session_id);

	if (!status) {
		return (
			<Notice
				body="checkout.getStatus() returned nothing. If you were charged, you'll still receive a receipt by email."
				title="Couldn't load your order"
			/>
		);
	}

	const paid =
		status.paymentStatus === "paid" ||
		status.paymentStatus === "no_payment_required";

	return (
		<div className="bd-section--narrow">
			<div className="bd-card order">
				<span className="bd-badge">{paid ? "Paid" : "Pending"}</span>
				<h1 className="bd-section__title">
					{paid ? "Thanks for your order!" : "Payment pending"}
				</h1>
				<p className="bd-section__sub">
					{paid
						? "Your payment went through. A receipt is on its way to your email."
						: "We haven't confirmed payment yet. Check back shortly."}
				</p>
				<dl className="order__meta">
					{status.amountTotalCents != null ? (
						<div>
							<dt>Total</dt>
							<dd>
								{usd(status.amountTotalCents / 100, status.currency ?? "USD")}
							</dd>
						</div>
					) : null}
					{status.customerEmail ? (
						<div>
							<dt>Email</dt>
							<dd>{status.customerEmail}</dd>
						</div>
					) : null}
				</dl>
				<Link className="bd-btn bd-btn--ghost" href="/store">
					Back to store
				</Link>
			</div>
		</div>
	);
}
