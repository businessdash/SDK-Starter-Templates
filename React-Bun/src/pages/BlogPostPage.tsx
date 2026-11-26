// [bd-file:blog]
import { useEffect } from "react";

import { BlogPost } from "../components/blog/BlogPost";
import { bd } from "../lib/bd";
import { Link } from "../lib/router";
import { useRoute } from "../lib/route";
import { ErrorBox } from "./ui";
import { useApi } from "./use-api";

/**
 * One post. Its HTML is rebuilt from an allowlist on the server
 * (`safePostHtml`, in server.ts) and only that reaches the page. Likes and
 * comments are for signed-in customers; signed out, they lead to sign-in and
 * back here.
 */
export function BlogPostPage() {
	const { path } = useRoute();
	const slug = decodeURIComponent(path.split("/")[2] ?? "");
	const { data, error, loading } = useApi(() => bd.blog.getPost(slug), [slug]);
	const page = data && data.post.slug === slug ? data : null;

	useEffect(() => {
		if (page) document.title = `${page.post.title} — Blog`;
	}, [page]);

	return (
		<main className="bd-page">
			{page ? (
				<BlogPost
					data={page}
					key={page.post.slug}
					onComment={(content) => bd.blog.comment(slug, content)}
					onLike={() => bd.blog.toggleLike(slug)}
					signInHref={`/my-account?next=${encodeURIComponent(`/blog/${slug}`)}`}
				/>
			) : loading ? (
				<p className="bd-loading">Loading post…</p>
			) : error ? (
				<ErrorBox error={error} />
			) : (
				<div className="bd-empty">
					That post isn't here.
					<p>
						<Link className="bd-btn" to="/blog">
							All posts
						</Link>
					</p>
				</div>
			)}
		</main>
	);
}
