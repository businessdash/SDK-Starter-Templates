// [bd-file:blog]
import { formatPostDate } from "../../../lib/shop/blog";

/** The author's photo and name, the date, and the reading time. */
export function PostMeta({
	authorName,
	authorAvatarUrl,
	publishedAt,
	minutes,
}: {
	authorName: string | null | undefined;
	authorAvatarUrl: string | null | undefined;
	publishedAt: string | null | undefined;
	minutes: number;
}) {
	return (
		<p class="post__meta">
			{authorAvatarUrl ? (
				<img
					width={32}
					height={32}
					alt=""
					referrerPolicy="no-referrer"
					src={authorAvatarUrl}
				/>
			) : null}
			{authorName ? <span>{authorName}</span> : null}
			<span>{formatPostDate(publishedAt)}</span>
			<span>· {minutes} min read</span>
		</p>
	);
}
