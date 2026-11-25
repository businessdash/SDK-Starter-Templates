import { component$, useVisibleTask$ } from "@builder.io/qwik";
import { type DocumentHead, Link, routeLoader$ } from "@builder.io/qwik-city";

import { Footer } from "../../components/bd/Footer";
import { SiteHeader } from "../../components/bd/SiteHeader";
import { getBd } from "../../lib/bd";
import { elementHtml } from "../../lib/bd-elements";
import { getCustomerSession } from "../../lib/bd-portal";
import {
	type BundleReviewTotals,
	formatReviewDate,
	platformName,
	reviewerInitial,
	reviewerName,
	reviewLink,
	reviewStars,
	safeImage,
	sourceLabel,
} from "../../lib/shop/reviews";
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
	const { summary } = data;
	const average = summary.average?.toFixed(1) ?? null;

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
						<section class="reviews-summary" aria-label={average ? "Rating" : "Write a review"}>
							{average ? (
								<>
									<div class="reviews-summary__score">
										<span class="reviews-summary__average">{average}</span>
										<span class="review-stars" role="img" aria-label={`${average} out of 5`}>
											{reviewStars(summary.average ?? 0)}
										</span>
										<span class="reviews-summary__count">
											{summary.total} {summary.total === 1 ? "review" : "reviews"}
										</span>
									</div>
									<ul class="reviews-bars">
										{summary.histogram.map((row) => (
											<li key={row.stars} aria-label={`${row.stars} stars: ${row.count}`}>
												<span>{row.stars} ★</span>
												<span class="reviews-bars__track">
													<span
														class="reviews-bars__fill"
														style={{ width: `${Math.round(row.share * 100)}%` }}
													/>
												</span>
												<span>{row.count}</span>
											</li>
										))}
									</ul>
								</>
							) : null}
							<div
								class="reviews-summary__write"
								dangerouslySetInnerHTML={elementHtml(
									"bd-review-writer",
									{
										"data-write-url": "/api/bd/reviews/write",
										"data-sign-in-href": "/my-account?next=%2Freviews",
									},
									{ signedIn: data.signedIn },
								)}
							/>
						</section>

						{data.sources.length > 1 ? (
							<nav aria-label="Platform">
								<ul class="reviews-filter">
									<li>
										<Link href="/reviews" aria-current={data.source ? "false" : "true"}>
											All
										</Link>
									</li>
									{data.sources.map((source) => (
										<li key={source}>
											<Link
												href={`/reviews?source=${source}`}
												aria-current={data.source === source ? "true" : "false"}
											>
												{sourceLabel(source)}
											</Link>
										</li>
									))}
								</ul>
							</nav>
						) : null}

						{data.reviews.length === 0 ? (
							<p class="reviews-empty">
								{data.source
									? `No ${sourceLabel(data.source)} reviews yet.`
									: "No reviews yet. Connect Google or Yelp in BusinessDash, or add reviews in the dashboard, and they'll appear here."}
							</p>
						) : (
							<>
								<ul class="review-wall">
									{data.reviews.map((review, i) => {
										const avatar = safeImage(review.reviewerImageUrl);
										const platform = platformName(review.source);
										const link = reviewLink(review);
										const photos = (review.photos ?? [])
											.map(safeImage)
											.filter((p): p is string => p !== null);
										return (
											<li class="review-card" id={`review-${i}`} key={review.id}>
												<div class="review-card__head">
													{avatar ? (
														<img class="review-card__avatar" src={avatar} alt="" loading="lazy" width={40} height={40} />
													) : (
														<span class="review-card__avatar" aria-hidden="true">
															{reviewerInitial(review)}
														</span>
													)}
													<div>
														<p class="review-card__name">{reviewerName(review)}</p>
														<p class="review-card__meta">
															<span class="review-stars" role="img" aria-label={`${review.rating} out of 5`}>
																{reviewStars(review.rating)}
															</span>{" "}
															· {formatReviewDate(review.timeCreated)}
														</p>
													</div>
												</div>
												<p class="review-card__text">{review.text}</p>
												{photos.length > 0 ? (
													<ul class="review-card__photos" aria-label="Photos from the reviewer">
														{photos.map((photo) => (
															<li key={photo}>
																<img src={photo} alt="" loading="lazy" width={88} height={88} />
															</li>
														))}
													</ul>
												) : null}
												{platform || review.verified ? (
													<p class="review-card__foot">
														{platform ? <span class="review-card__platform">{platform}</span> : null}
														{review.verified ? <span class="review-card__verified">✓ Verified</span> : null}
														{link && platform ? (
															<a class="review-card__link" href={link} target="_blank" rel="noopener noreferrer">
																Read on {platform}
															</a>
														) : null}
													</p>
												) : null}
											</li>
										);
									})}
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
