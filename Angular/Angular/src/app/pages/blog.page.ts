// [bd-file:blog]
import {
	ChangeDetectionStrategy,
	Component,
	PLATFORM_ID,
	computed,
	inject,
	signal,
} from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Title } from "@angular/platform-browser";
import { ActivatedRoute, RouterLink } from "@angular/router";
import type { BlogCategory, BlogPublicPost } from "@businessdash/sdk/contracts";
import { bdApi } from "../lib/bd-api.client";
import { BlogFiltersComponent, blogQuery } from "../sections/blog/blog-filters.component";
import { PostCardComponent } from "../sections/blog/post-card.component";

/** Posts on a page. With a tag filter, more are read and filtered here. */
const PAGE = 12;

type Filters = { category: string | null; tag: string | null; cursor: number | null };

/**
 * The blog: posts newest first (pinned ones lead the first page), with
 * category and tag filters and "Older posts" paging, all in the URL
 * (?category, ?tag, ?cursor), so a filtered list can be shared. The page
 * is laid out from the blog's parts (src/app/sections/blog/): the filters
 * and a post card per post.
 */
@Component({
	selector: "bd-blog-page",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [BlogFiltersComponent, PostCardComponent, RouterLink],
	template: `
		<div class="bd-page">
			<div class="bd-section__lead">
				<span class="bd-section__eyebrow">Blog</span>
				<h1 class="bd-section__title">{{ active()?.name ?? "From the blog" }}</h1>
				@if (active()?.description; as description) {
					<p class="bd-section__sub">{{ description }}</p>
				}
			</div>

			<bd-blog-filters
				[categories]="categories()"
				[category]="filters().category"
				[tag]="filters().tag"
				[tags]="tags()"
			/>

			@switch (state()) {
				@case ("loading") {
					<p class="bd-loading">Loading posts…</p>
				}
				@case ("unavailable") {
					<div class="bd-empty">The blog isn't available right now. Please check back soon.</div>
				}
				@default {
					@if (cards().length === 0) {
						<div class="bd-empty">
							@if (filters().tag || filters().category) {
								No posts here yet.
							} @else {
								No posts published yet. Write one in Business Dash and it'll appear here.
							}
						</div>
					} @else {
						<ul class="posts">
							@for (post of cards(); track post.id; let first = $first) {
								<li bd-post-card [lead]="first && filters().cursor === null" [post]="post"></li>
							}
						</ul>
						@if (olderParams(); as params) {
							<p class="posts__more">
								<a class="bd-btn bd-btn--ghost" routerLink="/blog" [queryParams]="params">Older posts</a>
							</p>
						}
					}
				}
			}
		</div>
	`,
})
export class BlogPage {
	private readonly route = inject(ActivatedRoute);
	private readonly title = inject(Title);

	readonly filters = signal<Filters>({ category: null, tag: null, cursor: null });
	readonly posts = signal<BlogPublicPost[]>([]);
	readonly nextCursor = signal<number | null>(null);
	readonly categories = signal<BlogCategory[]>([]);
	readonly tags = signal<string[]>([]);
	readonly state = signal<"loading" | "ready" | "unavailable">("loading");
	private loadSeq = 0;

	readonly active = computed(() => this.categories().find((c) => c.id === this.filters().category) ?? null);

	/** The posts to show: a tag filters here; pinned posts lead the first page. */
	readonly cards = computed(() => {
		const { tag, cursor } = this.filters();
		const shown = this.posts().filter((post) => !tag || post.tags.includes(tag));
		return cursor !== null ? shown : [...shown].sort((a, b) => Number(b.isPinned) - Number(a.isPinned));
	});

	readonly olderParams = computed(() => {
		const next = this.nextCursor();
		const { category, tag } = this.filters();
		return next != null && !tag ? blogQuery({ category, cursor: next }) : null;
	});

	constructor() {
		const browser = isPlatformBrowser(inject(PLATFORM_ID));
		if (browser) {
			void bdApi.blogCategories().then((res) => this.categories.set(res?.items ?? []));
			void bdApi.blogTags().then((res) => this.tags.set(res?.items ?? []));
		}
		this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
			const cursor = Number.parseInt(params.get("cursor") ?? "", 10);
			this.filters.set({
				category: params.get("category") || null,
				tag: params.get("tag") || null,
				cursor: Number.isFinite(cursor) ? cursor : null,
			});
			if (browser) void this.load();
		});
	}

	private async load() {
		const seq = ++this.loadSeq;
		const { category, tag, cursor } = this.filters();
		this.state.set("loading");
		const res = await bdApi.blogPosts({ limit: tag ? 50 : PAGE, cursor, categoryId: category });
		if (seq !== this.loadSeq) return;
		if (!res) {
			this.state.set("unavailable");
			return;
		}
		this.posts.set(res.items);
		this.nextCursor.set(res.nextCursor);
		this.state.set("ready");
		this.title.setTitle(this.active() ? `${this.active()?.name} — Blog` : "Blog");
	}
}
