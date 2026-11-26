// [bd-file:blog]
/** The post's call to action: a line and a button. */
export function PostCta({
	label,
	href,
	description,
}: {
	label: string;
	href: string;
	description?: string | null;
}) {
	return (
		<aside class="bd-card post__cta">
			{description ? <p>{description}</p> : null}
			<a class="bd-btn" href={href}>
				{label}
			</a>
		</aside>
	);
}
