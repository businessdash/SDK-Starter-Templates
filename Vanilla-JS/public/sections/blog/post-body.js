// [bd-file:blog]
import { el } from "/bd.js";

/**
 * The post's text. `html` comes from the server already rebuilt from an
 * allowlist (`safePostHtml` in lib/shop/blog.ts); don't pass other HTML.
 */
export function postBody(html) {
	const body = el("div", { class: "post__body" }, []);
	body.innerHTML = html;
	return body;
}
