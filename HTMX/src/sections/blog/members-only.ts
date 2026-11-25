// [bd-file:blog]
import { html, type Raw } from "../../html";

/** In place of a members' post: Sign in to read it. */
export function membersOnly(signInHref: string): Raw {
	return html`<div class="bd-empty">This post is for members.<p><a class="bd-btn" href="${signInHref}">Sign in to read it</a></p></div>`;
}
