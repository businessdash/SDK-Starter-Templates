import { createFileRoute, Link } from "@tanstack/solid-router";
import { For, Show } from "solid-js";

import { elementHtml, loadReviewElements } from "../lib/bd-elements";
import { getReviewsPage } from "../lib/bd-server-fns";
import {
	formatReviewDate,
	platformName,
	type ReviewSource,
	reviewerInitial,
	reviewerName,
	reviewLink,
	reviewSourceParam,
	reviewStars,
	safeImage,
	sourceLabel,
	type WallReview,
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
	const average = () => data().summary.average?.toFixed(1) ?? null;

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
				<section
					class="reviews-summary"
					aria-label={average() ? "Rating" : "Write a review"}
				>
					<Show when={average()}>
						<div class="reviews-summary__score">
							<span class="reviews-summary__average">{average()}</span>
							<span
								class="review-stars"
								role="img"
								aria-label={`${average()} out of 5`}
							>
								{reviewStars(data().summary.average ?? 0)}
							</span>
							<span class="reviews-summary__count">
								{data().summary.total}{" "}
								{data().summary.total === 1 ? "review" : "reviews"}
							</span>
						</div>
						<ul class="reviews-bars">
							<For each={data().summary.histogram}>
								{(row) => (
									<li aria-label={`${row.stars} stars: ${row.count}`}>
										<span>{row.stars} ★</span>
										<span class="reviews-bars__track">
											<span
												class="reviews-bars__fill"
												style={{ width: `${Math.round(row.share * 100)}%` }}
											/>
										</span>
										<span>{row.count}</span>
									</li>
								)}
							</For>
						</ul>
					</Show>
					<div
						class="reviews-summary__write"
						innerHTML={elementHtml(
							"bd-review-writer",
							{
								"data-write-url": "/api/bd/reviews/write",
								"data-sign-in-href": "/my-account?next=%2Freviews",
							},
							{ signedIn: data().signedIn },
						)}
					/>
				</section>

				<Show when={data().sources.length > 1}>
					{/* Plain links, not <Link>: <Link> sets aria-current itself, to
					    "page" whenever its search partly matches, so "All" would
					    count as current on every platform. */}
					<nav aria-label="Platform">
						<ul class="reviews-filter">
							<li>
								<a
									href="/reviews"
									aria-current={data().source ? "false" : "true"}
								>
									All
								</a>
							</li>
							<For each={data().sources}>
								{(source) => (
									<li>
										<a
											href={`/reviews?source=${source}`}
											aria-current={data().source === source ? "true" : "false"}
										>
											{sourceLabel(source)}
										</a>
									</li>
								)}
							</For>
						</ul>
					</nav>
				</Show>

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

function ReviewCard(props: { review: WallReview; index: number }) {
	const avatar = () => safeImage(props.review.reviewerImageUrl);
	const platform = () => platformName(props.review.source);
	const link = () => reviewLink(props.review);
	const photos = () =>
		(props.review.photos ?? [])
			.map(safeImage)
			.filter((p): p is string => p !== null);

	return (
		<li class="review-card" id={`review-${props.index}`}>
			<div class="review-card__head">
				<Show
					when={avatar()}
					fallback={
						<span class="review-card__avatar" aria-hidden="true">
							{reviewerInitial(props.review)}
						</span>
					}
				>
					<img
						class="review-card__avatar"
						src={avatar() ?? ""}
						alt=""
						loading="lazy"
					/>
				</Show>
				<div>
					<p class="review-card__name">{reviewerName(props.review)}</p>
					<p class="review-card__meta">
						<span
							class="review-stars"
							role="img"
							aria-label={`${props.review.rating} out of 5`}
						>
							{reviewStars(props.review.rating)}
						</span>{" "}
						· {formatReviewDate(props.review.timeCreated)}
					</p>
				</div>
			</div>
			<p class="review-card__text">{props.review.text}</p>
			<Show when={photos().length > 0}>
				<ul class="review-card__photos" aria-label="Photos from the reviewer">
					<For each={photos()}>
						{(photo) => (
							<li>
								<img src={photo} alt="" loading="lazy" />
							</li>
						)}
					</For>
				</ul>
			</Show>
			<Show when={platform() || props.review.verified}>
				<p class="review-card__foot">
					<Show when={platform()}>
						<span class="review-card__platform">{platform()}</span>
					</Show>
					<Show when={props.review.verified}>
						<span class="review-card__verified">✓ Verified</span>
					</Show>
					<Show when={link() && platform()}>
						<a
							class="review-card__link"
							href={link() ?? ""}
							target="_blank"
							rel="noopener noreferrer"
						>
							Read on {platform()}
						</a>
					</Show>
				</p>
			</Show>
		</li>
	);
}
