import { ChangeDetectionStrategy, Component, inject, OnInit } from "@angular/core";
import { BdService } from "../lib/bd.service";

@Component({
	selector: "bd-blog",
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<section class="section" id="blog">
			<h2 class="section__title">From the blog</h2>
			@if (svc.blog().length === 0) {
				<p class="muted">No posts yet — author them in BD and they appear here.</p>
			} @else {
				<ul class="post-list">
					@for (post of svc.blog(); track post.slug) {
						<li>
							<a [href]="'/blog/' + post.slug">
								<strong>{{ post.title }}</strong>
								<span class="muted">{{ post.publishedAt }}</span>
							</a>
							<p>{{ post.excerpt }}</p>
						</li>
					}
				</ul>
			}
		</section>
	`,
})
export class BlogComponent implements OnInit {
	readonly svc = inject(BdService);
	ngOnInit() {
		void this.svc.loadBlog();
	}
}
