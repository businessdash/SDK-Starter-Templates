// [bd-file:blog]
import { html, raw, type Raw } from "../../html";
import { safePostHtml } from "../../shop/blog";

/** The post's text, rebuilt from an allowlist (`safePostHtml`, src/shop/blog.ts); only that reaches the page. */
export function postBody(content: string): Raw {
	return html`<div class="post__body">${raw(safePostHtml(content))}</div>`;
}
