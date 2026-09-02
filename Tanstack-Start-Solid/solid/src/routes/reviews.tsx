import type { ReviewWallItem } from "@businessdash/sdk/contracts";
import { createFileRoute } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";

import { fetchReviewsPage, getReviewsWall } from "../lib/biab-server-fns";

/**
 * Reviews wall. The aggregate (average / count) rides the marketing
 * bundle; the first page of wall items comes from `reviews.list`. "Load
 * more" pages forward via the `fetchReviewsPage` server fn until the
 * server returns `nextOffset: null`.
 *
 * Note the two distinct review shapes: the bundle aggregate carries
 * `{ reviewee, description, date }`, while wall items are
 * `{ reviewerName, text, timeCreated }`. We render the wall items here.
 */
export const Route = createFileRoute("/reviews")({
	component: ReviewsWall,
	loader: () => getReviewsWall(),
});

function stars(rating: number): string {
	const full = Math.round(rating);
	return "★★★★★".slice(0, full) + "☆☆☆☆☆".slice(0, 5 - full);
}

function formatDate(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "";
	return d.toLocaleDateString(undefined, { year: "numeric", month: "short" });
}

function ReviewsWall() {
	const data = Route.useLoaderData();
	const [items, setItems] = createSignal<ReviewWallItem[]>(
		data().page?.items ?? [],
	);
	const [nextOffset, setNextOffset] = createSignal<number | null>(
		data().page?.nextOffset ?? null,
	);
	const [busy, setBusy] = createSignal(false);

	const aggregate = () => data().aggregate;

	async function loadMore() {
		const offset = nextOffset();
		if (offset == null) return;
		setBusy(true);
		const page = await fetchReviewsPage({ data: { offset } });
		setBusy(false);
		if (page) {
			setItems([...items(), ...page.items]);
			setNextOffset(page.nextOffset);
		} else {
			setNextOffset(null);
		}
	}

	return (
		<main>
			<section class="biab-section biab-section--narrow">
				<div class="biab-section__lead">
					<span class="biab-section__eyebrow">Reviews</span>
					<h1 class="biab-section__title">What customers say</h1>
					<Show when={aggregate()?.rating != null}>
						<p class="biab-section__sub">
							{stars(aggregate()?.rating ?? 0)}{" "}
							{(aggregate()?.rating ?? 0).toFixed(1)} average across{" "}
							{aggregate()?.totalCount ?? 0} reviews
						</p>
					</Show>
				</div>

				<Show
					when={items().length > 0}
					fallback={
						<div class="biab-empty">
							No reviews yet. Connect a Google/Yelp source in BIAB, or invite
							customers to leave one from their account.
						</div>
					}
				>
					<div style="display: flex; flex-direction: column; gap: 1rem;">
						<For each={items()}>
							{(review) => (
								<article
									class="biab-card"
									style="padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 0.4rem;"
								>
									<div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
										<div style="font-weight: 600; color: var(--title);">
											{review.reviewerName}
										</div>
										<div style="color: var(--accent);">
											{stars(review.rating)}
										</div>
									</div>
									<p>{review.text}</p>
									<div class="blog-card__meta">
										{formatDate(review.timeCreated)}
										<Show when={review.verified}> · Verified</Show>
									</div>
								</article>
							)}
						</For>
					</div>

					<Show when={nextOffset() != null}>
						<div style="text-align: center; margin-top: 1.5rem;">
							<button
								type="button"
								class="biab-btn biab-btn--ghost"
								disabled={busy()}
								onClick={loadMore}
							>
								{busy() ? "Loading…" : "Load more"}
							</button>
						</div>
					</Show>
				</Show>
			</section>
		</main>
	);
}
