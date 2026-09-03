import { getBd } from "../bd";
import { html, render } from "../html";

type Post = {
	slug: string;
	title: string;
	excerpt: string;
	publishedAt: string;
};

export async function renderBlog(): Promise<string> {
	let posts: Post[] = [];
	const bd = getBd();
	if (bd) {
		try {
			const list = await bd.blog.listPosts({ limit: 4 });
			if (Array.isArray(list?.items)) {
				posts = list.items.map((p) => ({
					slug: p.slug,
					title: p.title,
					excerpt: p.excerpt ?? "",
					publishedAt: String(p.publishedAt ?? ""),
				}));
			}
		} catch {
			/* leave empty */
		}
	}
	const empty = html`<p class="muted">
		No posts yet — author them in BD and they appear here.
	</p>`;
	const list = html`
		<ul class="post-list">
			${posts.map(
				(p) => html`
					<li>
						<a href="/blog/${p.slug}">
							<strong>${p.title}</strong>
							<span class="muted">${p.publishedAt}</span>
						</a>
						<p>${p.excerpt}</p>
					</li>
				`,
			)}
		</ul>
	`;
	return render(html`
		<section class="section" id="blog">
			<h2 class="section__title">From the blog</h2>
			${posts.length === 0 ? empty : list}
		</section>
	`);
}
