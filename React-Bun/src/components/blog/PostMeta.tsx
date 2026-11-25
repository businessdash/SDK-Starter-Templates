// [bd-file:blog]
import { formatPostDate } from "./blog";

/** The author (with their photo), the date and the reading time. */
export function PostMeta({
	authorName,
	authorAvatarUrl,
	publishedAt,
	minutes,
}: {
	authorName: string | null;
	authorAvatarUrl: string | null;
	publishedAt: string | null;
	minutes: number;
}) {
	return (
		<p className="post__meta">
			{authorAvatarUrl && (
				<img alt="" referrerPolicy="no-referrer" src={authorAvatarUrl} />
			)}
			{authorName && <span>{authorName}</span>}
			<span>{formatPostDate(publishedAt)}</span>
			<span>· {minutes} min read</span>
		</p>
	);
}
