import { useEffect, useState } from "react";
import { biab } from "../lib/biab";
import type { Loose } from "../lib/biab";
import { ErrorBox, PageHead } from "./ui";

function stars(n: any): string {
	const full = Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
	return "★".repeat(full) + "☆".repeat(5 - full);
}

export function Reviews() {
	const [items, setItems] = useState<Record<string, any>[]>([]);
	const [offset, setOffset] = useState<number | null>(0);
	const [total, setTotal] = useState<number | null>(null);
	const [error, setError] = useState<unknown>(null);
	const [loading, setLoading] = useState(false);

	const load = async (o: number) => {
		setLoading(true);
		try {
			const res: Loose = await biab.reviews.list({ limit: 10, offset: o });
			setItems((prev) => [...prev, ...(res.items ?? [])]);
			setTotal(typeof res.totalCount === "number" ? res.totalCount : null);
			setOffset(res.nextOffset ?? null);
		} catch (e) {
			setError(e);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void load(0);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<main className="page">
			<PageHead title="Reviews" sub="What customers say." />
			{total != null ? (
				<p className="review-count muted">
					{total} review{total === 1 ? "" : "s"}
				</p>
			) : null}
			{error && items.length === 0 ? <ErrorBox error={error} /> : null}
			<ul className="review-list">
				{items.map((r) => (
					<li key={r.id} className="review-card">
						<div className="review-card__head">
							{r.reviewerImageUrl ? <img className="review-card__avatar" src={r.reviewerImageUrl} alt="" /> : null}
							<div className="review-card__who">
								<div className="review-card__name">{r.reviewerName ?? "Anonymous"}</div>
								<div className="review-card__stars" aria-label={`${r.rating} out of 5`}>
									{stars(r.rating)}
								</div>
							</div>
							{r.source ? <span className="review-card__source">{r.source}</span> : null}
						</div>
						<p className="review-card__text">{r.text ?? ""}</p>
					</li>
				))}
			</ul>
			{!loading && items.length === 0 && !error ? <p className="muted">No reviews yet.</p> : null}
			<div className="review-more">
				{offset != null ? (
					<button className="btn btn--ghost" type="button" disabled={loading} onClick={() => void load(offset)}>
						{loading ? "Loading…" : "Load more"}
					</button>
				) : null}
			</div>
		</main>
	);
}
