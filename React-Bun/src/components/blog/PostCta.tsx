// [bd-file:blog]
/** The post's call to action: a line of text and a button. */
export function PostCta({
	label,
	href,
	description,
}: {
	label: string;
	href: string;
	description: string | null;
}) {
	return (
		<aside className="bd-card post__cta">
			{description && <p>{description}</p>}
			<a className="bd-btn" href={href}>
				{label}
			</a>
		</aside>
	);
}
