// [bd-file:blog]
import { Link } from "@tanstack/solid-router";
import { For, Show } from "solid-js";

/** The post's tags, each listing the posts with it. */
export function PostTags(props: { tags: string[] }) {
	return (
		<Show when={props.tags.length > 0}>
			<ul class="post__tags">
				<For each={props.tags}>
					{(t) => (
						<li>
							<Link search={{ tag: t }} to="/blog">
								#{t}
							</Link>
						</li>
					)}
				</For>
			</ul>
		</Show>
	);
}
