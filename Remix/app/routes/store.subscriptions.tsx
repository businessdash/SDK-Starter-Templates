import { Form, useActionData, useLoaderData } from "react-router";
import { redirect } from "react-router";
import type {
	ActionFunctionArgs,
	LoaderFunctionArgs,
	MetaFunction,
} from "react-router";

import { SiteHeader } from "~/components/SiteHeader";
import {
	formatCents,
	getCartSnapshot,
	listStoreSubscriptions,
	startSubscriptionCheckout,
} from "~/lib/biab-store.server";

export const meta: MetaFunction = () => [
	{ title: "Subscriptions — Your Business" },
];

export async function loader({ request }: LoaderFunctionArgs) {
	const [list, cart] = await Promise.all([
		listStoreSubscriptions(),
		getCartSnapshot(request),
	]);
	return {
		connected: list !== null,
		offerings: (list?.items ?? []).map((s) => ({
			id: s.id,
			name: s.name,
			description: s.description ?? "",
			image: s.imageUrl,
			priceLabel: `${formatCents(s.amountCents)} / ${s.interval}`,
		})),
		cartCount: cart?.itemCount ?? 0,
	};
}

export async function action({ request }: ActionFunctionArgs) {
	const fd = await request.formData();
	const offeringId = String(fd.get("offeringId") ?? "");
	const origin = new URL(request.url).origin;
	const res = await startSubscriptionCheckout(offeringId, origin);
	if (res.ok) return redirect(res.url);
	return { ok: false as const, error: res.error };
}

export default function SubscriptionsPage() {
	const { connected, offerings, cartCount } = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	return (
		<>
			<SiteHeader cartCount={cartCount} />
			<main>
				<section className="section">
					<h1 className="section__title">Subscriptions</h1>
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
									<Form method="post">
										<input type="hidden" name="offeringId" value={o.id} />
										<button className="biab-btn" type="submit">
											Subscribe
										</button>
									</Form>
								</article>
							))}
						</div>
					)}
				</section>
			</main>
		</>
	);
}
