import {
	ChangeDetectionStrategy,
	Component,
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
import { RatingSummaryComponent } from "../sections/reviews/rating-summary.component";
import { ReviewCardComponent } from "../sections/reviews/review-card.component";
import { ReviewFilterComponent } from "../sections/reviews/review-filter.component";
import { sourceLabel } from "../shop/reviews";
import type { ReviewsPageData } from "../shop/reviews-page";

/**
 * The business's reviews: the rating with a bar per star, a platform filter
 * (`?source=`), each review with its photos, Verified and a link to it on
 * Google or Yelp, "Show more" (`?shown=`), and writing one. The server
 * gathers the page (`GET /api/bd/reviews/page`); `<bd-review-writer>`
 * (src/app/shop/reviews-elements.ts) posts a written review to
 * `POST /api/bd/reviews/write`, and signed out it's a link to sign in. The
 * rules are src/app/shop/reviews.ts, the same in every BD starter. The page
 * is laid out from the reviews' parts (src/app/sections/reviews/): the
 * rating summary, the platform filter and a card per review.
 */
@Component({
	selector: "bd-reviews-page",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [RatingSummaryComponent, ReviewCardComponent, ReviewFilterComponent, RouterLink],
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
							<bd-rating-summary [signedIn]="v.signedIn" [summary]="v.summary" />
							<bd-review-filter [source]="v.source" [sources]="v.sources" />

							@if (v.cards.length === 0) {
								<p class="reviews-empty">{{ v.emptyMessage }}</p>
							} @else {
								<ul class="review-wall">
									@for (review of v.cards; track review.id; let i = $index) {
										<li bd-review-card [id]="'review-' + i" [review]="review"></li>
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
		return {
			configured: data.configured,
			summary: data.summary,
			signedIn: data.signedIn,
			sources: data.sources,
			source: data.source,
			cards: data.reviews,
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
