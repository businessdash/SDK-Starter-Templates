// [bd-file:blog]
/** In place of a members-only post's text, signed out: Sign in to read it. */
export function MembersOnly({ signInHref }: { signInHref: string }) {
	return (
		<div class="bd-empty">
			This post is for members.
			<p>
				<a class="bd-btn" href={signInHref}>
					Sign in to read it
				</a>
			</p>
		</div>
	);
}
