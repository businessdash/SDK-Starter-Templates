// [bd-file:blog]
import { Show } from "solid-js";

import { formatPostDate } from "../../../lib/shop/blog";

/** The author's photo and name, the date, and the reading time. */
export function PostMeta(props: {
	authorName: string | null | undefined;
	authorAvatarUrl: string | null | undefined;
	publishedAt: string | null | undefined;
	minutes: number;
}) {
	return (
		<p class="post__meta">
			<Show when={props.authorAvatarUrl}>
				<img
					alt=""
					referrerpolicy="no-referrer"
					src={props.authorAvatarUrl ?? ""}
				/>
			</Show>
			<Show when={props.authorName}>
				<span>{props.authorName}</span>
			</Show>
			<span>{formatPostDate(props.publishedAt)}</span>
			<span>· {props.minutes} min read</span>
		</p>
	);
}
