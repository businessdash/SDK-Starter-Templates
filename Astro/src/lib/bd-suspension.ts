import {
	BdPaymentLapsedError,
	BdServiceSuspendedError,
} from "@businessdash/sdk";

/**
 * Suspension handling. When an org's billing lapses or its service is
 * suspended, the SDK throws one of these (both extend `BdAccessRejectedError`).
 * Surfaces should catch them and render a minimal "site unavailable" state
 * (with a 503 where the framework can set one) instead of a broken page.
 *
 * Usage in an `.astro` page:
 *
 *   import { isSuspensionError } from "../lib/bd-suspension";
 *   let suspended = false;
 *   try {
 *     data = await bd.storefront.listProducts();
 *   } catch (err) {
 *     if (isSuspensionError(err)) suspended = true;
 *     else throw err;
 *   }
 *   if (suspended) return new Response(unavailableHtml(), { status: 503, ... });
 */

export function isSuspensionError(err: unknown): boolean {
	return (
		err instanceof BdPaymentLapsedError ||
		err instanceof BdServiceSuspendedError
	);
}

/** Minimal standalone "site unavailable" document body. */
export function unavailableHtml(): string {
	return `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<meta name="robots" content="noindex" />
		<title>Temporarily unavailable</title>
		<style>
			body { font: 16px/1.6 system-ui, sans-serif; color: #4a444f;
				background: #fdfcfb; display: grid; place-items: center;
				min-height: 100vh; margin: 0; text-align: center; padding: 2rem; }
			h1 { color: #08060d; font-size: 1.6rem; margin: 0 0 0.5rem; }
			p { max-width: 32rem; }
		</style>
	</head>
	<body>
		<main>
			<h1>We'll be right back</h1>
			<p>This site is temporarily unavailable. Please check back shortly.</p>
		</main>
	</body>
</html>`;
}

/** A ready-made 503 Response for suspended state (use from page frontmatter). */
export function suspendedResponse(): Response {
	return new Response(unavailableHtml(), {
		status: 503,
		headers: {
			"Content-Type": "text/html; charset=utf-8",
			"Retry-After": "3600",
		},
	});
}
