/**
 * The shop's, the blog's and the reviews' custom elements (src/shop/*.ts)
 * for the browser.
 * There is no bundler in this starter, so the server bundles each entry with
 * Bun.build and serves it under /shop/. Built once in production; rebuilt on
 * every request in development, so edits show up.
 */
const ELEMENT_BUNDLES: Record<string, string> = {
	// [bd:store]
	"/shop/shop-elements.js": "./src/shop/shop-elements.ts",
	// [/bd:store]
	// [bd:blog]
	"/shop/blog-elements.js": "./src/shop/blog-elements.ts",
	// [/bd:blog]
	"/shop/reviews-elements.js": "./src/shop/reviews-elements.ts",
};

const built = new Map<string, Promise<string | null>>();

async function build(entry: string): Promise<string | null> {
	try {
		const result = await Bun.build({ entrypoints: [entry], target: "browser", format: "esm" });
		const out = result.outputs.find((o) => o.kind === "entry-point");
		if (!result.success || !out) {
			console.error(`[bd] couldn't bundle ${entry}`, result.logs);
			return null;
		}
		return await out.text();
	} catch (err) {
		console.error(`[bd] couldn't bundle ${entry}`, err);
		return null;
	}
}

/** The bundle for a /shop/*.js path, or null when the path isn't one. */
export async function serveElements(pathname: string): Promise<Response | null> {
	const entry = ELEMENT_BUNDLES[pathname];
	if (!entry) return null;
	const pending = process.env.NODE_ENV === "production" ? (built.get(pathname) ?? build(entry)) : build(entry);
	built.set(pathname, pending);
	const code = await pending;
	if (!code) {
		built.delete(pathname);
		return new Response(`// ${entry} didn't build; see the server log\n`, {
			status: 503,
			headers: { "Content-Type": "text/javascript; charset=utf-8" },
		});
	}
	return new Response(code, {
		headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-cache" },
	});
}
