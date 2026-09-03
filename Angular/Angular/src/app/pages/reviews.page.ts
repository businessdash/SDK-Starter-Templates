import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { bdApi, type ReviewWallPage } from "../lib/bd-api.client";
import { BdService } from "../lib/bd.service";

type WallItem = ReviewWallPage["items"][number];

/**
 * Reviews wall. Aggregate (average + count) comes from the marketing bundle
 * (loaded by BdService); the review bodies paginate via `/api/bd/reviews`
 * with a "Load more" button that walks the `nextOffset` cursor.
 */
@Component({
	selector: "bd-reviews-page",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [RouterLink],
	template: `
		<section class="section">
			<h1 class="section__title">Reviews</h1>

			@if (aggregate(); as agg) {
				<p class="reviews-agg"><strong>{{ agg.rating }}</strong> average · {{ agg.count }} reviews</p>
			}

			@if (items().length === 0 && state() === "ready") {
				<p class="muted">No reviews yet.</p>
			}

			<ul class="review-list">
				@for (r of items(); track r.id) {
					<li class="review">
						<div class="review__head">
							<strong>{{ r.reviewerName }}</strong>
							<span class="review__stars">{{ stars(r.rating) }}</span>
						</div>
						<p>{{ r.text }}</p>
						<span class="muted review__source">{{ r.source }}</span>
					</li>
				}
			</ul>

			@if (nextOffset() != null) {
				<button class="bd-btn bd-btn--ghost" type="button" (click)="loadMore()" [disabled]="loading()">
					{{ loading() ? "Loading…" : "Load more" }}
				</button>
			}

			<p class="store-links"><a routerLink="/">Back home</a></p>
		</section>
	`,
})
export class ReviewsPage implements OnInit {
	readonly svc = inject(BdService);
	readonly items = signal<WallItem[]>([]);
	readonly nextOffset = signal<number | null>(0);
	readonly loading = signal(false);
	readonly state = signal<"loading" | "ready">("loading");

	readonly aggregate = computed(() => {
		const agg = this.svc.reviewsAggregate();
		if (!agg || agg.totalCount == null || agg.totalCount === 0) return null;
		return { rating: agg.rating != null ? agg.rating.toFixed(1) : "—", count: agg.totalCount };
	});

	async ngOnInit() {
		void this.svc.loadHome();
		await this.loadMore();
	}

	async loadMore() {
		const offset = this.nextOffset();
		if (offset == null) return;
		this.loading.set(true);
		const page = await bdApi.reviews(offset, 10);
		this.loading.set(false);
		this.state.set("ready");
		if (!page) {
			this.nextOffset.set(null);
			return;
		}
		this.items.update((cur) => [...cur, ...page.items]);
		this.nextOffset.set(page.nextOffset);
	}

	stars(rating: number): string {
		const n = Math.max(0, Math.min(5, Math.round(rating)));
		return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);
	}
}
