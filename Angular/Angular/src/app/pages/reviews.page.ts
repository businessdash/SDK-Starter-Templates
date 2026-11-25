import {
	ChangeDetectionStrategy,
	Component,
	CUSTOM_ELEMENTS_SCHEMA,
	Injector,
	PLATFORM_ID,
	afterNextRender,
	computed,
	inject,
	signal,
} from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Title } from "@angular/platform-browser";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { bdApi } from "../lib/bd-api.client";
import {
	formatReviewDate,
	platformName,
	reviewerInitial,
	reviewerName,
	reviewLink,
	reviewStars,
	safeImage,
	sourceLabel,
} from "../shop/reviews";
import type { ReviewsPageData } from "../shop/reviews-page";

/**
 * The business's reviews: the rating with a bar per star, a platform filter
 * (`?source=`), each review with its photos, Verified and a link to it on
 * Google or Yelp, "Show more" (`?shown=`), and writing one. The server
 * gathers the page (`GET /api/bd/reviews/page`); `<bd-review-writer>`
 * (src/app/shop/reviews-elements.ts) posts a written review to
 * `POST /api/bd/reviews/write`, and signed out it's a link to sign in. The
 * rules are src/app/shop/reviews.ts, the same in every BD starter.
 */
@Component({
	selector: "bd-reviews-page",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [RouterLink],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	template: `
		<div class="bd-page">
			<div class="bd-section__lead">
				<span class="bd-section__eyebrow">Reviews</span>
				<h1 class="bd-section__title">What customers say</h1>
			</div>
			@switch (state()) {
				@case ("loading") {
					<p class="bd-loading">Loading reviews…</p>
				}
				@case ("unavailable") {
					<div class="bd-empty">Reviews aren't available right now. Please check back soon.</div>
				}
				@default {
					@if (view(); as v) {
						@if (!v.configured) {
							<div class="bd-empty">
								Reviews aren't connected yet. Set BD_API_KEY and BD_SITE_ID, and your rating and
								reviews appear here.
							</div>
						} @else {
							<section class="reviews-summary" [attr.aria-label]="v.average ? 'Rating' : 'Write a review'">
								@if (v.average) {
									<div class="reviews-summary__score">
										<span class="reviews-summary__average">{{ v.average }}</span>
										<span class="review-stars" role="img" [attr.aria-label]="v.average + ' out of 5'">{{
											v.averageStars
										}}</span>
										<span class="reviews-summary__count">{{ v.totalLabel }}</span>
									</div>
									<ul class="reviews-bars">
										@for (bar of v.bars; track bar.stars) {
											<li [attr.aria-label]="bar.stars + ' stars: ' + bar.count">
												<span>{{ bar.stars }} ★</span>
												<span class="reviews-bars__track"
													><span class="reviews-bars__fill" [style.width.%]="bar.width"></span
												></span>
												<span>{{ bar.count }}</span>
											</li>
										}
									</ul>
								}
								<div class="reviews-summary__write">
									<bd-review-writer
										data-write-url="/api/bd/reviews/write"
										data-sign-in-href="/my-account?next=%2Freviews"
										[data]="v.writer"
									></bd-review-writer>
								</div>
							</section>

							@if (v.chips.length > 1) {
								<nav aria-label="Platform">
									<ul class="reviews-filter">
										@for (chip of v.chips; track chip.label) {
											<li>
												<a
													routerLink="/reviews"
													[queryParams]="chip.params"
													[attr.aria-current]="chip.current ? 'true' : 'false'"
													>{{ chip.label }}</a
												>
											</li>
										}
									</ul>
								</nav>
							}

							@if (v.cards.length === 0) {
								<p class="reviews-empty">{{ v.emptyMessage }}</p>
							} @else {
								<ul class="review-wall">
									@for (card of v.cards; track card.id) {
										<li class="review-card" [id]="card.anchor">
											<div class="review-card__head">
												@if (card.avatar) {
													<img class="review-card__avatar" [src]="card.avatar" alt="" loading="lazy" />
												} @else {
													<span class="review-card__avatar" aria-hidden="true">{{ card.initial }}</span>
												}
												<div>
													<p class="review-card__name">{{ card.name }}</p>
													<p class="review-card__meta">
														<span class="review-stars" role="img" [attr.aria-label]="card.rating + ' out of 5'">{{
															card.stars
														}}</span>
														· {{ card.date }}
													</p>
												</div>
											</div>
											<p class="review-card__text">{{ card.text }}</p>
											@if (card.photos.length > 0) {
												<ul class="review-card__photos" aria-label="Photos from the reviewer">
													@for (photo of card.photos; track photo) {
														<li><img [src]="photo" alt="" loading="lazy" /></li>
													}
												</ul>
											}
											@if (card.platform || card.verified) {
												<p class="review-card__foot">
													@if (card.platform) {
														<span class="review-card__platform">{{ card.platform }}</span>
													}
													@if (card.verified) {
														<span class="review-card__verified">✓ Verified</span>
													}
													@if (card.link && card.platform) {
														<a class="review-card__link" [href]="card.link" target="_blank" rel="noopener noreferrer"
															>Read on {{ card.platform }}</a
														>
													}
												</p>
											}
										</li>
									}
								</ul>
								@if (v.more; as more) {
									<p class="reviews-more">
										<a
											class="bd-btn bd-btn--ghost"
											routerLink="/reviews"
											[queryParams]="more.params"
											[fragment]="more.fragment"
											>Show more reviews</a
										>
									</p>
								}
							}
						}
					}
				}
			}
		</div>
	`,
})
export class ReviewsPage {
	private readonly route = inject(ActivatedRoute);
	private readonly injector = inject(Injector);
	private readonly title = inject(Title);

	readonly page = signal<ReviewsPageData | null>(null);
	readonly state = signal<"loading" | "ready" | "unavailable">("loading");
	private loadSeq = 0;

	/** What the template draws, worked out from the page's data. */
	readonly view = computed(() => {
		const data = this.page();
		if (!data) return null;
		const { summary } = data;
		const average = summary.average?.toFixed(1) ?? null;
		return {
			configured: data.configured,
			average,
			averageStars: reviewStars(summary.average ?? 0),
			totalLabel: `${summary.total} ${summary.total === 1 ? "review" : "reviews"}`,
			bars: summary.histogram.map((row) => ({ ...row, width: Math.round(row.share * 100) })),
			writer: { signedIn: data.signedIn },
			chips:
				data.sources.length > 1
					? [
							{ label: "All", params: {}, current: !data.source },
							...data.sources.map((source) => ({
								label: sourceLabel(source),
								params: { source },
								current: data.source === source,
							})),
						]
					: [],
			cards: data.reviews.map((review, i) => {
				const platform = platformName(review.source);
				return {
					id: review.id,
					anchor: `review-${i}`,
					avatar: safeImage(review.reviewerImageUrl),
					initial: reviewerInitial(review),
					name: reviewerName(review),
					rating: review.rating,
					stars: reviewStars(review.rating),
					date: formatReviewDate(review.timeCreated),
					text: review.text,
					photos: (review.photos ?? []).map(safeImage).filter((p): p is string => p !== null),
					platform,
					verified: review.verified === true,
					link: reviewLink(review),
				};
			}),
			emptyMessage: data.source
				? `No ${sourceLabel(data.source)} reviews yet.`
				: "No reviews yet. Connect Google or Yelp in BusinessDash, or add reviews in the dashboard, and they'll appear here.",
			more: data.moreHref ? linkParts(data.moreHref) : null,
		};
	});

	constructor() {
		const browser = isPlatformBrowser(inject(PLATFORM_ID));
		afterNextRender(() => void import("../shop/reviews-elements"));
		this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
			const query = new URLSearchParams();
			for (const key of ["source", "shown"]) {
				const value = params.get(key);
				if (value) query.set(key, value);
			}
			const search = query.toString();
			if (browser) void this.load(search ? `?${search}` : "");
		});
	}

	private async load(search: string) {
		const seq = ++this.loadSeq;
		const data = await bdApi.reviewsPage(search);
		if (seq !== this.loadSeq) return;
		if (!data) {
			this.state.set("unavailable");
			return;
		}
		this.page.set(data);
		this.state.set("ready");
		this.title.setTitle("Reviews");
		// "Show more" leads to the first new review, there once it's drawn.
		const fragment = this.route.snapshot.fragment;
		if (fragment) {
			afterNextRender(() => document.getElementById(fragment)?.scrollIntoView(), {
				injector: this.injector,
			});
		}
	}
}

/** "/reviews?source=yelp&shown=20#review-10" as router link parts. */
function linkParts(href: string): { params: Record<string, string>; fragment: string | undefined } {
	const url = new URL(href, "http://reviews.invalid");
	return {
		params: Object.fromEntries(url.searchParams),
		fragment: url.hash ? url.hash.slice(1) : undefined,
	};
}
