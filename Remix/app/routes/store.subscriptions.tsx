// [bd-file:saas]
import { Form, useActionData, useLoaderData } from "react-router";
import { redirect } from "react-router";
import type {
	ActionFunctionArgs,
	LoaderFunctionArgs,
	MetaFunction,
} from "react-router";

import { SiteHeader } from "~/components/SiteHeader";
// [bd:store]
import { getCartSnapshot } from "~/lib/bd-store.server";
// [/bd:store]
import { getCustomerSession, startPlanCheckout } from "~/lib/bd-portal.server";
import {
	formatCents,
	listStoreSubscriptions,
	sdkErrorMessage,
} from "~/lib/bd-store.server";

const SIGN_IN = "/my-account?next=/store/subscriptions";

export const meta: MetaFunction = () => [
	{ title: "Subscriptions — Your Business" },
];

export async function loader({ request }: LoaderFunctionArgs) {
	const [list, session] = await Promise.all([
		listStoreSubscriptions(),
		getCustomerSession(request),
	]);
	// The header's cart badge; a project without a store has no cart.
	let cartCount = 0;
	// [bd:store]
	cartCount = (await getCartSnapshot(request))?.itemCount ?? 0;
	// [/bd:store]
	return {
		connected: list !== null,
		offerings: (list?.items ?? []).map((s) => ({
			id: s.id,
			name: s.name,
			description: s.description ?? "",
			image: s.imageUrl,
			priceLabel: `${formatCents(s.amountCents)} / ${s.interval}`,
		})),
		cartCount,
		signedIn: session !== null,
		// Stripe sends the customer back here with the session id.
		subscribed: new URL(request.url).searchParams.has("session_id"),
	};
}

export async function action({ request }: ActionFunctionArgs) {
	const fd = await request.formData();
	const offeringId = String(fd.get("offeringId") ?? "");
	const origin = new URL(request.url).origin;
	try {
		// A plan is the signed-in customer's own; anyone else signs in first.
		const res = await startPlanCheckout(request, offeringId, {
			successUrl: `${origin}/store/subscriptions?session_id={CHECKOUT_SESSION_ID}`,
			cancelUrl: `${origin}/store/subscriptions`,
		});
		return redirect(res ? res.url : SIGN_IN);
	} catch (err) {
		return { ok: false as const, error: sdkErrorMessage(err) };
	}
}

export default function SubscriptionsPage() {
	const { connected, offerings, cartCount, signedIn, subscribed } =
		useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	return (
		<>
			<SiteHeader cartCount={cartCount} />
			<main>
				<section className="section">
					<h1 className="section__title">Subscriptions</h1>
					{subscribed ? (
						<p className="muted">
							Thanks for subscribing. Your plan is in{" "}
							<a href="/my-account">your account</a>.
						</p>
					) : null}
					{actionData && actionData.ok === false ? (
						<p className="error">{actionData.error}</p>
					) : null}
					{!connected ? (
						<p className="muted">Subscriptions aren't connected yet.</p>
					) : offerings.length === 0 ? (
						<p className="muted">No subscription plans yet.</p>
					) : (
						<div className="grid">
							{offerings.map((o) => (
								<article className="card" key={o.id}>
									{o.image ? (
										<img className="card__img" src={o.image} alt={o.name} />
									) : null}
									<h3>{o.name}</h3>
									{o.description ? <p>{o.description}</p> : null}
									<span className="price">{o.priceLabel}</span>
									{signedIn ? (
										<Form method="post">
											<input type="hidden" name="offeringId" value={o.id} />
											<button className="bd-btn" type="submit">
												Subscribe
											</button>
										</Form>
									) : (
										<a className="bd-btn" href={SIGN_IN}>
											Sign in to subscribe
										</a>
									)}
								</article>
							))}
						</div>
					)}
				</section>
			</main>
		</>
	);
}
