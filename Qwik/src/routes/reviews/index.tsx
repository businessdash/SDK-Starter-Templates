import { component$, useVisibleTask$ } from "@builder.io/qwik";
import { type DocumentHead, Link, routeLoader$ } from "@builder.io/qwik-city";

import { Footer } from "../../components/bd/Footer";
import { RatingSummary } from "../../components/bd/reviews/RatingSummary";
import { ReviewCard } from "../../components/bd/reviews/ReviewCard";
import { ReviewFilter } from "../../components/bd/reviews/ReviewFilter";
import { SiteHeader } from "../../components/bd/SiteHeader";
import { getBd } from "../../lib/bd";
import { getCustomerSession } from "../../lib/bd-portal";
import { type BundleReviewTotals, sourceLabel } from "../../lib/shop/reviews";
import { loadReviewsPage } from "../../lib/shop/reviews-page";

/**
 * The business's reviews: the rating with a bar per star, a platform filter
 * (`?source=`), each review with its photos, Verified and a link to it on
 * Google or Yelp, "Show more" (`?shown=`), and writing one. The filter and
 * "Show more" are links. Writing one is `<bd-review-writer>`
 * (src/lib/shop/reviews-elements.ts), which posts to /api/bd/reviews/write;
 * signed out, it's a link to sign in. The rules are src/lib/shop/reviews.ts,
 * the same in every BD starter.
 */
export const useReviews = routeLoader$(async ({ url, cookie }) => {
	const bd = getBd();
	const session = getCustomerSession(cookie).catch(() => null);
	const data = await loadReviewsPage({
		params: url.searchParams,
		list: bd ? (query) => bd.reviews.list(query) : null,
		totals: bd
			? bd.marketing
					.getPageBundle({ pageKey: "home", locale: "en" })
					.then((bundle) => (bundle as { reviews?: BundleReviewTotals | null }).reviews)
			: Promise.resolve(null),
		signedIn: session.then((s) => s !== null),
	});
	return { ...data, headerSignedIn: (await session) !== null };
});

export default component$(() => {
	const page = useReviews();

	// eslint-disable-next-line qwik/no-use-visible-task
	useVisibleTask$(
		() => {
			void import("../../lib/shop/reviews-elements");
		},
		{ strategy: "document-ready" },
	);

	const data = page.value;

	return (
		<>
			<SiteHeader signedIn={data.headerSignedIn} />
			<main class="bd-section bd-section--narrow">
				<div class="bd-section__lead">
					<span class="bd-section__eyebrow">Reviews</span>
					<h1 class="bd-section__title">What customers say</h1>
				</div>

				{!data.configured ? (
					<div class="bd-empty">
						Reviews aren't connected yet. Set BD_API_KEY and BD_SITE_ID, and your
						rating and reviews appear here.
					</div>
				) : (
					<>
						<RatingSummary signedIn={data.signedIn} summary={data.summary} />

						<ReviewFilter source={data.source} sources={data.sources} />

						{data.reviews.length === 0 ? (
							<p class="reviews-empty">
								{data.source
									? `No ${sourceLabel(data.source)} reviews yet.`
									: "No reviews yet. Connect Google or Yelp in BusinessDash, or add reviews in the dashboard, and they'll appear here."}
							</p>
						) : (
							<>
								<ul class="review-wall">
									{data.reviews.map((review, i) => (
										<ReviewCard index={i} key={review.id} review={review} />
									))}
								</ul>
								{data.moreHref ? (
									<p class="reviews-more">
										<Link class="bd-btn bd-btn--ghost" href={data.moreHref}>
											Show more reviews
										</Link>
									</p>
								) : null}
							</>
						)}
					</>
				)}
			</main>
			<Footer />
		</>
	);
});

export const head: DocumentHead = {
	title: "Reviews — Your Business",
	meta: [{ name: "description", content: "What customers say: the rating and every review." }],
};
