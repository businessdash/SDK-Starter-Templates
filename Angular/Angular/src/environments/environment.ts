/**
 * Development environment (default, replaced by `environment.prod.ts` in a
 * production build — see `fileReplacements` in `angular.json`).
 *
 * The values below are the BROWSER-SAFE BD credentials only. The powerful
 * per-site API key never lives here — it stays on the Node SSR server (see
 * `.env` / `src/server/bd-server.ts`). What ships in the browser bundle is
 * the publishable token (`pk_…`, origin-locked, rate-limited, scoped to
 * `followers:self`), which is safe to expose and needs no backend.
 *
 * Fill these in to enable the newsletter / Subscribe component. Leave them
 * blank and the Subscribe UI degrades to a "coming soon" placeholder so the
 * template still runs in an unconfigured checkout.
 */
export const environment = {
	production: false,
	/** Browser-safe publishable token (`pk_…`). Empty → Subscribe placeholder. */
	bdPk: "",
	/** The uuid of your BD site (from the dashboard URL). */
	bdSiteId: "",
	/** Your BD instance origin. Defaults to the platform apex when blank. */
	bdBaseUrl: "https://www.biab.app",
};
