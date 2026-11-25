// [bd-file:blog]
import { el } from "/bd.js";

/** In place of a members' post: Sign in to read it. */
export function membersOnly(signInHref) {
	return el("div", { class: "bd-empty" }, [
		"This post is for members.",
		el("p", {}, [el("a", { class: "bd-btn", href: signInHref }, ["Sign in to read it"])]),
	]);
}
