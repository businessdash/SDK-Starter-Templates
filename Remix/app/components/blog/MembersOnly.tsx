// [bd-file:blog]
import { BdLink } from "../bd-link";

/** In place of a members-only post's body: sign in to read it. */
export function MembersOnly({ signInHref }: { signInHref: string }) {
	return (
		<div className="bd-empty">
			This post is for members.
			<p>
				<BdLink className="bd-btn" href={signInHref}>
					Sign in to read it
				</BdLink>
			</p>
		</div>
	);
}
