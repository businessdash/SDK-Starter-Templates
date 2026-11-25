// [bd-file:tailwind]
/**
 * Tailwind CSS, for your own markup. The server builds `src/tailwind.css`
 * with Tailwind's engine (the one its Vite and PostCSS plugins use) and
 * serves the result at /tailwind.css, which every page links. Tailwind finds
 * the classes you use by scanning the project's files, skipping node_modules
 * and anything .gitignore'd.
 *
 * In development it rebuilds on every request, so a class you add shows up
 * on reload. In production it builds once, on the first request.
 */
import { compile } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";

const ENTRY = "src/tailwind.css";
let built: Promise<string> | undefined;

async function build(): Promise<string> {
	const root = process.cwd();
	const compiler = await compile(await Bun.file(`${root}/${ENTRY}`).text(), {
		base: `${root}/src`,
		onDependency: () => {},
	});
	// Where to look for classes: the whole project, unless tailwind.css says
	// otherwise with `source(…)` or `@source`.
	const sources = [
		...(compiler.root === "none"
			? []
			: compiler.root === null
				? [{ base: root, pattern: "**/*", negated: false }]
				: [{ ...compiler.root, negated: false }]),
		...compiler.sources,
	];
	return compiler.build(new Scanner({ sources }).scan());
}

/** GET /tailwind.css */
export async function tailwindCss(): Promise<Response> {
	const production = process.env.NODE_ENV === "production";
	try {
		const css = await (production ? (built ??= build()) : build());
		return new Response(css, {
			headers: {
				"Content-Type": "text/css; charset=utf-8",
				"Cache-Control": production ? "public, max-age=300" : "no-cache",
			},
		});
	} catch (error) {
		built = undefined;
		const message = error instanceof Error ? error.message : String(error);
		console.error(`Tailwind couldn't build ${ENTRY}: ${message}`);
		return new Response(`/* Tailwind couldn't build ${ENTRY}: ${message.replaceAll("*/", "* /")} */\n`, {
			status: 500,
			headers: { "Content-Type": "text/css; charset=utf-8" },
		});
	}
}
