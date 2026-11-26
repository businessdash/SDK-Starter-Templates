// [bd-file:blog]
/**
 * The blog's shared logic: making a post's HTML safe to put on the page, and
 * the small things every post shows (date, reading time).
 *
 * ## Why the post body is rebuilt, not trusted
 *
 * A post's `content` is HTML written in the BusinessDash editor, and the API
 * returns it as it was saved. Anyone who can write a post could otherwise put
 * a script on this site. `safePostHtml` reads the HTML and writes out only
 * the tags and attributes on the lists below, with every value escaped again;
 * everything else becomes text. Nothing from the input reaches the page
 * without being rebuilt, so there is no pattern to slip past.
 */

const ALLOWED_TAGS = new Set([
	"a",
	"abbr",
	"b",
	"blockquote",
	"br",
	"caption",
	"code",
	"del",
	"div",
	"em",
	"figcaption",
	"figure",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"hr",
	"i",
	"img",
	"ins",
	"kbd",
	"li",
	"mark",
	"ol",
	"p",
	"pre",
	"s",
	"small",
	"span",
	"strong",
	"sub",
	"sup",
	"table",
	"tbody",
	"td",
	"tfoot",
	"th",
	"thead",
	"tr",
	"u",
	"ul",
]);
const VOID_TAGS = new Set(["br", "hr", "img"]);
/** Tags whose whole content goes, not only the tag. */
const DROPPED_WITH_CONTENT = new Set([
	"script",
	"style",
	"iframe",
	"object",
	"embed",
	"template",
	"noscript",
	"textarea",
	"select",
]);
const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
	"*": new Set(["title", "id", "class"]),
	a: new Set(["href"]),
	img: new Set(["src", "alt", "width", "height", "loading"]),
	td: new Set(["colspan", "rowspan"]),
	th: new Set(["colspan", "rowspan", "scope"]),
	ol: new Set(["start"]),
};
const URL_ATTRIBUTES = new Set(["href", "src"]);

function escapeText(value: string): string {
	// An entity already in the text (&amp; &#8217;) stays one.
	return value
		.replace(
			/&(?![a-zA-Z][a-zA-Z0-9]{1,31};|#[0-9]{1,7};|#x[0-9a-fA-F]{1,6};)/g,
			"&amp;",
		)
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
	return escapeText(value).replace(/"/g, "&quot;");
}

function decodeEntities(value: string): string {
	return value
		.replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) =>
			String.fromCodePoint(Number.parseInt(hex, 16) || 0xfffd),
		)
		.replace(/&#([0-9]+);?/g, (_, dec: string) =>
			String.fromCodePoint(Number.parseInt(dec, 10) || 0xfffd),
		)
		.replace(/&colon;/gi, ":")
		.replace(/&tab;/gi, "\t")
		.replace(/&newline;/gi, "\n")
		.replace(/&amp;/gi, "&");
}

/** http(s), mailto, tel, a path on this site, or a #fragment. */
function safeUrl(raw: string): string | null {
	// Browsers ignore control characters and whitespace inside a scheme
	// ("java\nscript:"), so they are removed before the check.
	// biome-ignore lint/suspicious/noControlCharactersInRegex: removing control characters is the point
	const value = decodeEntities(raw).replace(/[\u0000- \u007f-\u009f]/g, "");
	if (/^(https?:|mailto:|tel:)/i.test(value)) return raw.trim();
	if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;
	if (value.startsWith("//")) return null;
	return raw.trim();
}

const TAG = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/y;
const ATTRIBUTE =
	/([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

/** Make a post's HTML safe to render (see the note at the top). */
export function safePostHtml(html: string): string {
	let out = "";
	const open: string[] = [];
	let i = 0;
	let dropping: string | null = null;
	while (i < html.length) {
		const lt = html.indexOf("<", i);
		if (lt === -1) {
			if (!dropping) out += escapeText(html.slice(i));
			break;
		}
		if (!dropping) out += escapeText(html.slice(i, lt));
		if (html.startsWith("<!--", lt)) {
			const end = html.indexOf("-->", lt + 4);
			i = end === -1 ? html.length : end + 3;
			continue;
		}
		TAG.lastIndex = lt;
		const match = TAG.exec(html);
		if (!match) {
			if (!dropping) out += "&lt;";
			i = lt + 1;
			continue;
		}
		i = TAG.lastIndex;
		const closing = match[0].startsWith("</");
		const name = (match[1] ?? "").toLowerCase();
		if (dropping) {
			if (closing && name === dropping) dropping = null;
			continue;
		}
		if (DROPPED_WITH_CONTENT.has(name)) {
			if (!closing && !match[0].endsWith("/>")) dropping = name;
			continue;
		}
		if (!ALLOWED_TAGS.has(name)) continue;
		if (closing) {
			const at = open.lastIndexOf(name);
			if (at === -1) continue;
			// Close anything left open inside it, so the nesting stays whole.
			while (open.length > at) out += `</${open.pop()}>`;
			continue;
		}
		const allowed = ALLOWED_ATTRIBUTES[name];
		let attributes = "";
		let external = false;
		for (const attribute of (match[2] ?? "").matchAll(ATTRIBUTE)) {
			const key = (attribute[1] ?? "").toLowerCase();
			if (!ALLOWED_ATTRIBUTES["*"]?.has(key) && !allowed?.has(key)) continue;
			let value = attribute[2] ?? attribute[3] ?? attribute[4] ?? "";
			if (URL_ATTRIBUTES.has(key)) {
				const url = safeUrl(value);
				if (url === null) continue;
				value = url;
				if (key === "href" && /^https?:/i.test(url)) external = true;
			}
			attributes += ` ${key}="${escapeAttribute(value)}"`;
		}
		if (name === "a" && external) {
			attributes += ' target="_blank" rel="noopener noreferrer nofollow"';
		}
		if (name === "img" && !/\sloading=/.test(attributes))
			attributes += ' loading="lazy"';
		out += `<${name}${attributes}>`;
		if (!VOID_TAGS.has(name)) open.push(name);
	}
	while (open.length > 0) out += `</${open.pop()}>`;
	return out;
}

/** The words a post has, for reading time; tags don't count. */
export function readingMinutes(html: string): number {
	const words = html
		.replace(/<[^>]*>/g, " ")
		.trim()
		.split(/\s+/)
		.filter(Boolean).length;
	return Math.max(1, Math.round(words / 230));
}

export function formatPostDate(
	iso: string | null | undefined,
	locale?: string,
): string {
	if (!iso) return "";
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleDateString(locale, {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}
