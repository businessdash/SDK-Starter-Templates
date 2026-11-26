// [bd-file:subscriptions]
import { useState } from "react";
import { bd, type Loose, money } from "../lib/bd";
import { ErrorBox, PageHead } from "./ui";
import { useApi } from "./use-api";
import { StoreNav } from "../components/StoreNav";

const SIGN_IN = "/my-account?next=/subscriptions";

/** The plans page, under the store bar. */
export function Subscriptions() {
	return (
		<>
			<StoreNav />
			<SubscriptionsBody />
		</>
	);
}

function SubscriptionsBody() {
	const { data, error, loading } = useApi(() => bd.subscriptions.list());
	const items: Loose[] = data?.items ?? [];
	const subscribed = new URLSearchParams(window.location.search).has("session_id");
	const [busyId, setBusyId] = useState<string | null>(null);
	const [failure, setFailure] = useState<string | null>(null);

	// A plan is the signed-in customer's own; anyone else signs in first.
	const subscribe = async (planId: string) => {
		setBusyId(planId);
		setFailure(null);
		try {
			const res = await bd.subscriptions.checkout(planId, window.location.origin);
			window.location.assign(res.url ?? res.signIn ?? SIGN_IN);
		} catch (e) {
			setFailure(e instanceof Error ? e.message : "Couldn't start checkout.");
			setBusyId(null);
		}
	};
	return (
		<main className="page">
			<PageHead title="Plans" sub="Recurring subscriptions, billed via Stripe." />
			{subscribed ? (
				<p className="muted">
					Thanks for subscribing. Your plan is in <a href="/my-account">your account</a>.
				</p>
			) : null}
			{loading ? <p className="muted">Loading…</p> : null}
			{error ? <ErrorBox error={error} /> : null}
			{data && items.length === 0 ? <p className="muted">No subscription plans yet.</p> : null}
			{items.length > 0 ? (
				<div className="plan-grid">
					{items.map((p) => (
						<div key={p.id} className="plan-card">
							{p.imageUrl ? <img className="plan-card__img" src={p.imageUrl} alt={p.name} /> : null}
							<h3 className="plan-card__name">{p.name ?? "Plan"}</h3>
							{p.description ? <p className="plan-card__desc">{p.description}</p> : null}
							<div className="plan-card__price">
								{money(p.amountCents, p.currency)}
								<span className="plan-card__interval"> / {p.interval ?? "month"}</span>
							</div>
							{data?.signedIn ? (
								<button
									className="btn btn--primary"
									type="button"
									disabled={busyId === p.id}
									onClick={() => subscribe(p.id)}
								>
									{busyId === p.id ? "Working…" : "Subscribe"}
								</button>
							) : (
								<a className="btn btn--primary" href={SIGN_IN}>
									Sign in to subscribe
								</a>
							)}
						</div>
					))}
				</div>
			) : null}
			{failure ? <p className="rf__msg">{failure}</p> : null}
		</main>
	);
}
