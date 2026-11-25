import { createFileRoute, Link } from "@tanstack/solid-router";
import { For, Show } from "solid-js";

import { RatingSummary } from "../components/bd/reviews/RatingSummary";
import { ReviewCard } from "../components/bd/reviews/ReviewCard";
import { ReviewFilter } from "../components/bd/reviews/ReviewFilter";
import { loadReviewElements } from "../lib/bd-elements";
import { getReviewsPage } from "../lib/bd-server-fns";
import {
	type ReviewSource,
	reviewSourceParam,
	sourceLabel,
} from "../lib/shop/reviews";

type ReviewsSearch = { source?: ReviewSource; shown?: number };

/**
 * The business's reviews: the rating with a bar per star, a platform filter
 * (`?source=`), each review with its photos, Verified and a link to it on
 * Google or Yelp, "Show more" (`?shown=`), and writing one. The loader reads
 * the page on the server (`getReviewsPage`). Writing one is
 * `<bd-review-writer>` (src/lib/shop/reviews-elements.ts), which posts to
 * /api/bd/reviews/write; signed out, it's a link to sign in. The rules are
 * src/lib/shop/reviews.ts, the same in every BD starter.
 *
 * The page is laid out from the reviews' parts (src/components/bd/reviews/):
 * <RatingSummary>, <ReviewFilter> and a <ReviewCard> per review.
 */
export const Route = createFileRoute("/reviews")({
	validateSearch: (search: Record<string, unknown>): ReviewsSearch => {
		const shown = Number(search.shown);
		return {
			source: reviewSourceParam(search.source),
			shown: Number.isFinite(shown) && shown > 0 ? shown : undefined,
		};
	},
	loaderDeps: ({ search }) => search,
	loader: ({ deps }) => getReviewsPage({ data: deps }),
	head: () => ({ meta: [{ title: "Reviews" }] }),
	component: ReviewsPage,
});

/** "/reviews?shown=20#review-10" as the parts of a router link. */
function linkParts(href: string): { search: ReviewsSearch; hash: string } {
	const url = new URL(href, "http://reviews.invalid");
	const shown = Number(url.searchParams.get("shown"));
	return {
		search: {
			source: reviewSourceParam(url.searchParams.get("source")),
			shown: shown > 0 ? shown : undefined,
		},
		hash: url.hash.slice(1),
	};
}

function ReviewsPage() {
	loadReviewElements();
	const data = Route.useLoaderData();

	return (
		<main class="bd-page">
			<div class="bd-section__lead">
				<span class="bd-section__eyebrow">Reviews</span>
				<h1 class="bd-section__title">What customers say</h1>
			</div>

			<Show
				when={data().configured}
				fallback={
					<div class="bd-empty">
						Reviews aren't connected yet. Set BD_API_KEY and BD_SITE_ID, and
						your rating and reviews appear here.
					</div>
				}
			>
				<RatingSummary signedIn={data().signedIn} summary={data().summary} />
				<ReviewFilter source={data().source} sources={data().sources} />

				<Show
					when={data().reviews.length > 0}
					fallback={
						<p class="reviews-empty">
							{data().source
								? `No ${sourceLabel(data().source as ReviewSource)} reviews yet.`
								: "No reviews yet. Connect Google or Yelp in BusinessDash, or add reviews in the dashboard, and they'll appear here."}
						</p>
					}
				>
					<ul class="review-wall">
						<For each={data().reviews}>
							{(review, i) => <ReviewCard review={review} index={i()} />}
						</For>
					</ul>
					<Show when={data().moreHref}>
						{(href) => {
							const more = () => linkParts(href());
							return (
								<p class="reviews-more">
									<Link
										class="bd-btn bd-btn--ghost"
										to="/reviews"
										search={more().search}
										hash={more().hash}
									>
										Show more reviews
									</Link>
								</p>
							);
						}}
					</Show>
				</Show>
			</Show>
		</main>
	);
}
