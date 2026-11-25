// [bd-file:blog]
/** In place of a members-only post's body, for a reader who isn't signed in. */
export function MembersOnly(props: { signInHref: string }) {
	return (
		<div class="bd-empty">
			This post is for members.
			<p>
				<a class="bd-btn" href={props.signInHref}>
					Sign in to read it
				</a>
			</p>
		</div>
	);
}
