// [bd-file:blog]
import {
	ChangeDetectionStrategy,
	Component,
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
import { CommentsComponent } from "../sections/blog/comments.component";
import { LikeButtonComponent } from "../sections/blog/like-button.component";
import { MembersOnlyComponent } from "../sections/blog/members-only.component";
import { PostBodyComponent } from "../sections/blog/post-body.component";
import { PostCtaComponent } from "../sections/blog/post-cta.component";
import { PostMetaComponent } from "../sections/blog/post-meta.component";
import { PostTagsComponent } from "../sections/blog/post-tags.component";

/**
 * One post. The server rebuilds its HTML from an allowlist
 * (`safePostHtml`, src/app/shop/blog.ts) and only that comes back here.
 * Likes and comments are for signed-in customers: `<bd-post-like>` and
 * `<bd-post-comments>` (src/app/shop/blog-elements.ts) post JSON to
 * /api/bd/blog/post/:slug/like and /comment; signed out, they lead to
 * sign-in and back to the post. The page is laid out from the blog's parts
 * (src/app/sections/blog/): meta, body (or members-only), call to action,
 * tags, like button and comments.
 */
@Component({
	selector: "bd-blog-post-page",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		CommentsComponent,
		LikeButtonComponent,
		MembersOnlyComponent,
		PostBodyComponent,
		PostCtaComponent,
		PostMetaComponent,
		PostTagsComponent,
		RouterLink,
	],
	template: `
		<div class="bd-page">
			@if (state() === "missing") {
				<div class="bd-empty">That post isn't available. <a routerLink="/blog">See all posts</a></div>
			} @else if (view(); as v) {
				<article class="post">
					<a class="post__back" routerLink="/blog">← All posts</a>
					<header class="post__head">
						<h1>{{ v.post.title }}</h1>
						<bd-post-meta
							[authorAvatarUrl]="v.post.authorAvatarUrl"
							[authorName]="v.post.authorName"
							[minutes]="v.minutes"
							[publishedAt]="v.post.publishedAt"
						/>
					</header>
					@if (v.post.imageUrl) {
						<img alt="" class="post__cover" referrerpolicy="no-referrer" [src]="v.post.imageUrl" />
					}
					@if (v.paywalled) {
						<bd-members-only [signInHref]="v.signInHref" />
					} @else {
						<bd-post-body [html]="v.html" />
					}
					<bd-post-cta
						[description]="v.post.ctaDescription"
						[href]="v.post.ctaHref"
						[label]="v.post.ctaLabel"
					/>
					<bd-post-tags [tags]="v.post.tags" />
					<bd-like-button
						[likeUrl]="v.api + '/like'"
						[likes]="v.likes"
						[signInHref]="v.signInHref"
						[signedIn]="v.signedIn"
					/>
				</article>
				<bd-comments
					[commentUrl]="v.api + '/comment'"
					[comments]="v.comments"
					[signInHref]="v.signInHref"
					[signedIn]="v.signedIn"
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

	/** What the page shows, with where likes and comments go. */
	readonly view = computed(() => {
		const data = this.payload();
		if (!data) return null;
		const here = `/blog/${encodeURIComponent(data.post.slug)}`;
		return {
			...data,
			api: `/api/bd/blog/post/${encodeURIComponent(data.post.slug)}`,
			signInHref: `/my-account?next=${encodeURIComponent(here)}`,
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
