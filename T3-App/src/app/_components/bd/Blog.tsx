import type { BlogPost } from "@/server/api/routers/bd";

function formatDate(iso: string | null | undefined): string {
	if (!iso) return "";
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export function Blog({ posts }: { posts: BlogPost[] }) {
	return (
		<section className="bd-section" id="blog">
			<div className="bd-section__lead">
				<span className="bd-section__eyebrow">Latest</span>
				<h2 className="bd-section__title">From the blog</h2>
				<p className="bd-section__sub">
					Tips, customer stories, and what we're working on this month.
				</p>
			</div>
			{posts.length === 0 ? (
				<div className="bd-empty">
					No blog posts published yet. Add one in BD and it'll appear here.
				</div>
			) : (
				<div className="bd-grid-3">
					{posts.map((post) => (
						<a
							className="bd-card blog-card"
							href={`/blog/${post.slug}`}
							key={post.id}
						>
							<span className="blog-card__meta">
								{formatDate(post.publishedAt)}
							</span>
							<h3>{post.title}</h3>
							{post.excerpt ? <p>{post.excerpt}</p> : null}
						</a>
					))}
				</div>
			)}
		</section>
	);
}
