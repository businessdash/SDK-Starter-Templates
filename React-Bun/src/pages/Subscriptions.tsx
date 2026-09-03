import { bd, money } from "../lib/bd";
import { ErrorBox, PageHead, useApi } from "./ui";

export function Subscriptions() {
	const { data, error, loading } = useApi(() => bd.subscriptions.list());
	const items: Record<string, any>[] = data?.items ?? [];
	return (
		<main className="page">
			<PageHead title="Plans" sub="Recurring subscriptions, billed via Stripe." />
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
						</div>
					))}
				</div>
			) : null}
		</main>
	);
}
