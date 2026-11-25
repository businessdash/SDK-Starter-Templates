// [bd-file:blog]
import { Show } from "solid-js";

/** The post's call to action: a line and a button. */
export function PostCta(props: {
	label: string;
	href: string;
	description?: string | null;
}) {
	return (
		<aside class="bd-card post__cta">
			<Show when={props.description}>
				<p>{props.description}</p>
			</Show>
			<a class="bd-btn" href={props.href}>
				{props.label}
			</a>
		</aside>
	);
}
