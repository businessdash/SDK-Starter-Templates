"use client";

import { useState } from "react";

import { api } from "@/trpc/react";

type WallItem = {
	id: string;
	rating: number;
	text: string;
	reviewerName: string;
	source: string;
	timeCreated: string;
};

function formatDate(iso: string): string {
	const d = new Date(iso);
	return Number.isNaN(d.getTime())
		? ""
		: d.toLocaleDateString(undefined, { year: "numeric", month: "short" });
}

function Stars({ rating }: { rating: number }) {
	const full = Math.round(rating);
	return (
		<span aria-label={`${rating} out of 5`} className="review-stars" role="img">
			{"★".repeat(full)}
			{"☆".repeat(Math.max(0, 5 - full))}
		</span>
	);
}

/**
 * "Load more" pagination for the reviews wall. The server renders the first
 * page (off the marketing bundle); this client fetches deeper pages via the
 * `bd.reviewsPage` tRPC procedure, passing the previous `nextOffset`.
 */
export function ReviewsLoadMore({
	initialNextOffset,
	totalCount,
	shownCount,
}: {
	initialNextOffset: number | null;
	totalCount: number;
	shownCount: number;
}) {
	const [items, setItems] = useState<WallItem[]>([]);
	const [nextOffset, setNextOffset] = useState<number | null>(
		initialNextOffset,
	);
	const utils = api.useUtils();
	const [loading, setLoading] = useState(false);

	const loadedCount = shownCount + items.length;
	if (nextOffset === null && items.length === 0) return null;

	async function loadMore() {
		if (nextOffset === null) return;
		setLoading(true);
		try {
			const page = await utils.bd.reviewsPage.fetch({
				offset: nextOffset,
				limit: 10,
			});
			setItems((prev) => [...prev, ...page.items]);
			setNextOffset(page.nextOffset);
		} finally {
			setLoading(false);
		}
	}

	return (
		<>
			{items.length > 0 ? (
				<div className="bd-grid-3 review-wall__more">
					{items.map((r) => (
						<article className="bd-card review-card" key={r.id}>
							<Stars rating={r.rating} />
							<p className="review-card__body">{r.text}</p>
							<footer className="review-card__meta">
								<span>{r.reviewerName}</span>
								<span>
									{r.source} · {formatDate(r.timeCreated)}
								</span>
							</footer>
						</article>
					))}
				</div>
			) : null}

			{nextOffset !== null ? (
				<div className="review-wall__loadmore">
					<button
						className="bd-btn bd-btn--ghost"
						disabled={loading}
						onClick={loadMore}
						type="button"
					>
						{loading
							? "Loading…"
							: `Load more (${loadedCount} of ${totalCount})`}
					</button>
				</div>
			) : null}
		</>
	);
}
