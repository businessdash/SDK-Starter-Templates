// [bd-file:blog]
import { BdLink } from "../bd-link";

/** The post's tags, each a link to the posts with that tag. */
export function PostTags({ tags }: { tags: string[] }) {
	if (tags.length === 0) return null;
	return (
		<ul className="post__tags">
			{tags.map((tag) => (
				<li key={tag}>
					<BdLink href={`/blog?tag=${encodeURIComponent(tag)}`}>#{tag}</BdLink>
				</li>
			))}
		</ul>
	);
}
