/**
 * The shop's, the blog's and the reviews' custom elements (src/lib/shop/) as
 * HTML, for `dangerouslySetInnerHTML`. Qwik leaves what is inside alone, so
 * an element keeps the DOM it draws when the page around it renders again;
 * and on a client-side navigation the browser parses the element together
 * with its data, so it has the data the moment it starts.
 */

const ESCAPES: Record<string, string> = { "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" };

/** Text or an attribute value, safe to put in HTML. */
export function escapeHtml(value: string): string {
	return value.replace(/[&"<>]/g, (ch) => ESCAPES[ch] ?? ch);
}

/**
 * `<tag …attrs>` with the server's data as JSON inside it (`<` written as
 * \u003c, so the JSON can't end the script early). `inner` is markup to show
 * until the element draws itself; it is written as given.
 *
 * Fallback content for browsers without JavaScript goes in `inner` too, in a
 * `<noscript>`: a `<noscript>` in Qwik's own markup would hide nodes Qwik
 * expects to find when the page resumes.
 */
export function elementHtml(
	tag: string,
	attrs: Record<string, string | number | boolean | null | undefined>,
	data?: unknown,
	inner = "",
): string {
	const attributes = Object.entries(attrs)
		.filter(([, value]) => value !== null && value !== undefined && value !== false)
		.map(([name, value]) => (value === true ? ` ${name}` : ` ${name}="${escapeHtml(String(value))}"`))
		.join("");
	const json =
		data === undefined
			? ""
			: `<script type="application/json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
	return `<${tag}${attributes}>${json}${inner}</${tag}>`;
}
