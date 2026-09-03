import {
	isStoreConfigured,
	listStoreSubscriptions,
} from "@/server/lib/bd-store";

import { Notice } from "../_components/Notice";

export const dynamic = "force-dynamic";

function formatPrice(amountCents: number, interval: string): string {
	const amount = (amountCents / 100).toLocaleString("en-US", {
		style: "currency",
		currency: "USD",
	});
	return `${amount}/${interval}`;
}

export default async function SubscriptionsPage() {
	if (!isStoreConfigured()) {
		return (
			<Notice
				body="BD env (BD_API_KEY / BD_SITE_ID / base URL) isn't set, so the SDK client can't initialise."
				title="Store isn't connected"
			/>
		);
	}

	const data = await listStoreSubscriptions();

	if (data === null) {
		return (
			<Notice
				body="The SDK call threw — likely the org isn't entitled to subscriptions, or the package API is unreachable. Check the server logs."
				title="subscriptions.list() failed"
			/>
		);
	}

	if (data.items.length === 0) {
		return (
			<Notice
				body="No live subscription offerings yet. Add them in the BD dashboard (Store → Subscriptions)."
				title="No live subscriptions"
			/>
		);
	}

	return (
		<div>
			<div className="bd-section__lead">
				<span className="bd-section__eyebrow">Recurring</span>
				<h1 className="bd-section__title">Subscriptions</h1>
				<p className="bd-section__sub">
					{data.items.length} subscription
					{data.items.length === 1 ? "" : "s"} via{" "}
					<code className="bd-code">subscriptions.list()</code>
				</p>
			</div>
			<div className="bd-grid-3">
				{data.items.map((sub) => (
					<article className="bd-card store-card" key={sub.id}>
						<div className="store-card__media">
							{sub.imageUrl ? (
								// eslint-disable-next-line @next/next/no-img-element
								<img alt={sub.name} loading="lazy" src={sub.imageUrl} />
							) : (
								<span className="store-card__noimg">No image</span>
							)}
						</div>
						<div className="store-card__body">
							<h3>{sub.name}</h3>
							{sub.description ? (
								<p className="store-card__desc">{sub.description}</p>
							) : null}
							<span className="store-card__cta">
								{formatPrice(sub.amountCents, sub.interval)}
							</span>
						</div>
					</article>
				))}
			</div>
		</div>
	);
}
