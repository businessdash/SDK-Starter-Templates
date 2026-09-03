import { $, component$, useSignal } from "@builder.io/qwik";
import { type DocumentHead, routeLoader$, server$ } from "@builder.io/qwik-city";

import type { ReviewWallItem } from "@businessdash/sdk/contracts";

import { Footer } from "../../components/bd/Footer";
import { SiteHeader } from "../../components/bd/SiteHeader";
import { fetchReviewsPage } from "../../lib/bd-content";
import { getCustomerSession } from "../../lib/bd-portal";

const PAGE_SIZE = 10;

/**
 * Reviews wall. `routeLoader$` pulls the aggregate (totalCount) + the first
 * page server-side; "Load more" calls a `server$` that pages forward via
 * `reviews.list({ offset })` until `nextOffset` is null.
 */
export const useReviews = routeLoader$(async ({ cookie }) => {
	const [page, session] = await Promise.all([
		fetchReviewsPage({ limit: PAGE_SIZE }),
		getCustomerSession(cookie),
	]);
	return {
		configured: page !== null,
		items: page?.items ?? [],
		totalCount: page?.totalCount ?? 0,
		nextOffset: page?.nextOffset ?? null,
		signedIn: !!session,
	};
});

const loadMoreRpc = server$(async function (this, offset: number) {
	const page = await fetchReviewsPage({ limit: PAGE_SIZE, offset });
	return {
		items: page?.items ?? [],
		nextOffset: page?.nextOffset ?? null,
	};
});

function Stars({ rating }: { rating: number }) {
	const full = Math.round(rating);
	return (
		<span aria-label={`${rating} out of 5`} style="color: var(--accent);">
			{"★".repeat(full)}
			{"☆".repeat(Math.max(0, 5 - full))}
		</span>
	);
}

function formatDate(iso: string): string {
	const d = new Date(iso);
	return Number.isNaN(d.getTime())
		? ""
		: d.toLocaleDateString(undefined, {
				year: "numeric",
				month: "short",
				day: "numeric",
			});
}

export default component$(() => {
	const data = useReviews();
	const items = useSignal<ReviewWallItem[]>(data.value.items as ReviewWallItem[]);
	const nextOffset = useSignal<number | null>(data.value.nextOffset);
	const loading = useSignal(false);

	const loadMore = $(async () => {
		if (nextOffset.value === null) return;
		loading.value = true;
		const res = await loadMoreRpc(nextOffset.value);
		items.value = [...items.value, ...(res.items as ReviewWallItem[])];
		nextOffset.value = res.nextOffset;
		loading.value = false;
	});

	const avg =
		items.value.length > 0
			? items.value.reduce((sum, r) => sum + r.rating, 0) / items.value.length
			: 0;

	return (
		<>
			<SiteHeader signedIn={data.value.signedIn} />
			<main>
				<section class="bd-section bd-section--narrow">
					<div class="bd-section__lead">
						<span class="bd-section__eyebrow">Reviews</span>
						<h2 class="bd-section__title">What customers say</h2>
						{data.value.totalCount > 0 ? (
							<p class="bd-section__sub">
								<Stars rating={avg} /> · {data.value.totalCount} review
								{data.value.totalCount === 1 ? "" : "s"}
							</p>
						) : null}
					</div>

					{!data.value.configured ? (
						<div class="bd-empty">
							Reviews aren't connected yet. Set the BD env vars to pull them
							in.
						</div>
					) : items.value.length === 0 ? (
						<div class="bd-empty">No reviews yet. Be the first!</div>
					) : (
						<div style="display: flex; flex-direction: column; gap: 1rem;">
							{items.value.map((r) => (
								<div class="bd-card" style="padding: 1.5rem;" key={r.id}>
									<div style="display: flex; justify-content: space-between; align-items: center;">
										<strong style="color: var(--title);">
											{r.reviewerName}
										</strong>
										<Stars rating={r.rating} />
									</div>
									<p style="margin-top: 0.5rem;">{r.text}</p>
									<div style="color: var(--text-muted); font-size: 0.8rem; margin-top: 0.5rem;">
										{formatDate(r.timeCreated)}
										{r.verified ? " · Verified" : ""}
									</div>
								</div>
							))}

							{nextOffset.value !== null ? (
								<button
									class="bd-btn bd-btn--ghost"
									disabled={loading.value}
									onClick$={loadMore}
									style="align-self: center; margin-top: 1rem;"
									type="button"
								>
									{loading.value ? "Loading…" : "Load more"}
								</button>
							) : null}
						</div>
					)}
				</section>
			</main>
			<Footer />
		</>
	);
});

export const head: DocumentHead = {
	title: "Reviews — Your Business",
	meta: [
		{ name: "description", content: "Customer reviews, paginated via the SDK." },
	],
};
