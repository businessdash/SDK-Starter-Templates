/**
 * The shop's, the blog's and the reviews' custom elements (src/lib/shop/) as
 * HTML, for a wrapper's `innerHTML`. Solid leaves what is inside alone, so an
 * element keeps the DOM it draws; and when the page changes, the browser
 * parses the element together with its data, so it has the data the moment
 * it starts.
 */

const ESCAPES: Record<string, string> = {
	"&": "&amp;",
	'"': "&quot;",
	"<": "&lt;",
	">": "&gt;",
};

/** Text or an attribute value, safe to put in HTML. */
export function escapeHtml(value: string): string {
	return value.replace(/[&"<>]/g, (ch) => ESCAPES[ch] ?? ch);
}

/**
 * `<tag …attrs>` with the server's data as JSON inside it (`<` written as
 * \u003c, so the JSON can't end the script early). `inner` is markup to show
 * until the element draws itself, such as a `<noscript>` fallback; it is
 * written as given.
 */
export function elementHtml(
	tag: string,
	attrs: Record<string, string | number | boolean | null | undefined>,
	data?: unknown,
	inner = "",
): string {
	const attributes = Object.entries(attrs)
		.filter(
			([, value]) => value !== null && value !== undefined && value !== false,
		)
		.map(([name, value]) =>
			value === true ? ` ${name}` : ` ${name}="${escapeHtml(String(value))}"`,
		)
		.join("");
	const json =
		data === undefined
			? ""
			: `<script type="application/json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
	return `<${tag}${attributes}>${json}${inner}</${tag}>`;
}

// [bd:store]
/**
 * Load the shop's elements in the browser. Called where a page renders, it
 * does nothing on the server; in the browser the module loads once and the
 * elements on the page draw themselves.
 */
export function loadShopElements(): void {
	if (typeof window !== "undefined") void import("./shop/shop-elements");
}
// [/bd:store]

// [bd:blog]
/**
 * Load the blog's like button and comments in the browser. Called where a
 * page renders, it does nothing on the server.
 */
export function loadBlogElements(): void {
	if (typeof window !== "undefined") void import("./shop/blog-elements");
}
// [/bd:blog]

/**
 * Load the reviews page's writer (`<bd-review-writer>`) in the browser.
 * Called where a page renders, it does nothing on the server.
 */
export function loadReviewElements(): void {
	if (typeof window !== "undefined") void import("./shop/reviews-elements");
}
