// [bd-file:blog]
import {
	ChangeDetectionStrategy,
	Component,
	CUSTOM_ELEMENTS_SCHEMA,
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
import { bdApi, type BlogPostPayload } from "../lib/bd-api.client";
import { formatPostDate } from "../shop/blog";

/**
 * One post. The server rebuilds its HTML from an allowlist
 * (`safePostHtml`, src/app/shop/blog.ts) and only that comes back here.
 * Likes and comments are for signed-in customers: `<bd-post-like>` and
 * `<bd-post-comments>` (src/app/shop/blog-elements.ts) post JSON to
 * /api/bd/blog/post/:slug/like and /comment; signed out, they lead to
 * sign-in and back to the post.
 */
@Component({
	selector: "bd-blog-post-page",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [RouterLink],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	template: `
		<div class="bd-page">
			@if (state() === "missing") {
				<div class="bd-empty">That post isn't available. <a routerLink="/blog">See all posts</a></div>
			} @else if (view(); as v) {
				<article class="post">
					<a class="post__back" routerLink="/blog">← All posts</a>
					<header class="post__head">
						<h1>{{ v.post.title }}</h1>
						<p class="post__meta">
							@if (v.post.authorAvatarUrl) {
								<img alt="" referrerpolicy="no-referrer" [src]="v.post.authorAvatarUrl" />
							}
							@if (v.post.authorName) {
								<span>{{ v.post.authorName }}</span>
							}
							<span>{{ v.date }}</span>
							<span>· {{ v.minutes }} min read</span>
						</p>
					</header>
					@if (v.post.imageUrl) {
						<img alt="" class="post__cover" referrerpolicy="no-referrer" [src]="v.post.imageUrl" />
					}
					@if (v.paywalled) {
						<div class="bd-empty">
							This post is for members.
							<p><a class="bd-btn" [href]="v.signInHref">Sign in to read it</a></p>
						</div>
					} @else {
						<div class="post__body" [innerHTML]="v.html"></div>
					}
					@if (v.post.ctaHref && v.post.ctaLabel) {
						<aside class="bd-card post__cta">
							@if (v.post.ctaDescription) {
								<p>{{ v.post.ctaDescription }}</p>
							}
							<a class="bd-btn" [href]="v.post.ctaHref">{{ v.post.ctaLabel }}</a>
						</aside>
					}
					@if (v.post.tags.length > 0) {
						<ul class="post__tags">
							@for (t of v.post.tags; track t) {
								<li>
									<a routerLink="/blog" [queryParams]="{ tag: t }">#{{ t }}</a>
								</li>
							}
						</ul>
					}
					<bd-post-like
						[attr.data-like-url]="v.api + '/like'"
						[attr.data-sign-in-href]="v.signInHref"
						[data]="v.like"
					/>
				</article>
				<bd-post-comments
					[attr.data-comment-url]="v.api + '/comment'"
					[attr.data-sign-in-href]="v.signInHref"
					[data]="v.comments"
				/>
			} @else {
				<p class="bd-loading">Loading…</p>
			}
		</div>
	`,
})
export class BlogPostPage {
	private readonly route = inject(ActivatedRoute);
	private readonly title = inject(Title);

	readonly payload = signal<BlogPostPayload | null>(null);
	readonly state = signal<"loading" | "ready" | "missing">("loading");
	private loadSeq = 0;

	/** What the page shows, with the like and comment elements' data. */
	readonly view = computed(() => {
		const data = this.payload();
		if (!data) return null;
		const here = `/blog/${encodeURIComponent(data.post.slug)}`;
		return {
			...data,
			date: formatPostDate(data.post.publishedAt),
			api: `/api/bd/blog/post/${encodeURIComponent(data.post.slug)}`,
			signInHref: `/my-account?next=${encodeURIComponent(here)}`,
			like: { likes: data.likes, signedIn: data.signedIn },
			comments: { comments: data.comments, signedIn: data.signedIn },
		};
	});

	constructor() {
		const browser = isPlatformBrowser(inject(PLATFORM_ID));
		afterNextRender(() => void import("../shop/blog-elements"));
		this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
			if (browser) void this.load(params.get("slug") ?? "");
		});
	}

	private async load(slug: string) {
		const seq = ++this.loadSeq;
		const data = slug ? await bdApi.blogPost(slug) : null;
		if (seq !== this.loadSeq) return;
		if (!data) {
			this.state.set("missing");
			this.title.setTitle("Post not found");
			return;
		}
		this.payload.set(data);
		this.state.set("ready");
		this.title.setTitle(`${data.post.title} — Blog`);
	}
}
