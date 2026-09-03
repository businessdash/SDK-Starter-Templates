import {
	ApplicationConfig,
	PLATFORM_ID,
	provideAppInitializer,
	provideBrowserGlobalErrorListeners,
	inject,
} from "@angular/core";
import { provideRouter } from "@angular/router";
import { isPlatformBrowser } from "@angular/common";
import {
	provideClientHydration,
	withEventReplay,
} from "@angular/platform-browser";

import { routes } from "./app.routes";

/**
 * Browser-only initialiser that boots BD analytics once the client takes
 * over. Server render skips it. The server API key never lives in the
 * browser, so we fetch a browser-safe config from `/api/bd/public-config`
 * — which only returns an analytics key when the operator opts in via
 * `BD_PUBLIC_ANALYTICS_KEY`. Unset → analytics quietly stays off.
 */
function initAnalytics(): void {
	const platformId = inject(PLATFORM_ID);
	if (!isPlatformBrowser(platformId)) return;
	void fetch("/api/bd/public-config")
		.then((r) => (r.ok ? r.json() : null))
		.then((cfg: { analytics?: { siteId: string; baseUrl: string; apiKey: string } } | null) => {
			const a = cfg?.analytics;
			if (!a?.siteId || !a.baseUrl || !a.apiKey) return;
			void import("@businessdash/sdk/analytics-core").then(({ initBdAnalytics }) => {
				initBdAnalytics({ siteId: a.siteId, baseUrl: a.baseUrl, apiKey: a.apiKey });
			});
		})
		.catch(() => {
			/* analytics off */
		});
}

export const appConfig: ApplicationConfig = {
	providers: [
		provideBrowserGlobalErrorListeners(),
		provideRouter(routes),
		provideClientHydration(withEventReplay()),
		provideAppInitializer(initAnalytics),
	],
};
