// [bd-file:blog]
import { Link } from "@builder.io/qwik-city";

/** The post's tags, each linking to the posts with it. */
export function PostTags({ tags }: { tags: string[] }) {
	if (tags.length === 0) return null;
	return (
		<ul class="post__tags">
			{tags.map((t) => (
				<li key={t}>
					<Link href={`/blog?tag=${encodeURIComponent(t)}`}>#{t}</Link>
				</li>
			))}
		</ul>
	);
}
