// [bd-file:blog]
import type { BlogPublicComment } from "@businessdash/sdk/contracts";
import { formatPostDate } from "./blog";

/** The approved comments, oldest first; replies are indented. */
export function CommentList({ comments }: { comments: BlogPublicComment[] }) {
	if (comments.length === 0) return null;
	return (
		<ol className="comments__list">
			{comments.map((c) => (
				<li
					className={`comment${c.parentId !== null ? " comment--reply" : ""}`}
					key={c.id}
				>
					<p className="comment__head">
						<strong>{c.authorName ?? "Reader"}</strong>
						<span>{formatPostDate(c.createdAt)}</span>
					</p>
					<p className="comment__body">{c.content}</p>
				</li>
			))}
		</ol>
	);
}
