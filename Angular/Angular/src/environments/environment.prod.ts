/**
 * Production environment. Swapped in for `environment.ts` by the production
 * build via `fileReplacements` in `angular.json`.
 *
 * Only the BROWSER-SAFE publishable token (`pk_…`) belongs here — never the
 * server API key. See `src/environments/environment.ts` for the full note.
 */
export const environment = {
	production: true,
	biabPk: "",
	biabSiteId: "",
	biabBaseUrl: "https://www.biab.app",
};
