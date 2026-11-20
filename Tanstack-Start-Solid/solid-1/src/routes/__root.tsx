import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/solid-router";
import { TanStackRouterDevtools } from "@tanstack/solid-router-devtools";

import "@fontsource/inter/400.css";
// Styles for <BdForm> (file upload, multi-step progress header, choice chips).
// These surfaces are unstyled without it; imported once, globally.
import "@businessdash/sdk/bd-forms.css";

import { initBdAnalytics } from "@businessdash/sdk/analytics-core";
import { onCleanup, onMount, Suspense } from "solid-js";
import { HydrationScript } from "solid-js/web";

import Header from "../components/Header";
import { SdkSetupBanner } from "../components/bd/SdkSetupBanner";

import styleCss from "../styles.css?url";

export const Route = createRootRouteWithContext()({
	head: () => ({
		links: [{ rel: "stylesheet", href: styleCss }],
	}),
	shellComponent: RootComponent,
});

function RootComponent() {
	onMount(() => {
		// Canonical VITE_ names (exposed to the browser via envPrefix in
		// vite.config.ts), falling back to the legacy VITE_ twins.
		const siteId = (import.meta.env.VITE_BD_SITE_ID ??
			import.meta.env.VITE_BD_SITE_ID) as string | undefined;
		const baseUrl = (import.meta.env.VITE_BD_PACKAGE_API_BASE_URL ??
			import.meta.env.VITE_BD_PACKAGE_API_BASE_URL) as string | undefined;
		const apiKey = (import.meta.env.VITE_BD_PK ??
			import.meta.env.VITE_BD_PUBLIC_KEY) as string | undefined;
		if (!siteId || !baseUrl || !apiKey) return;
		const tracker = initBdAnalytics({ siteId, baseUrl, apiKey });
		onCleanup(() => tracker.stop());
	});

	return (
		<html lang="en">
			<head>
				<HydrationScript />
				<HeadContent />
			</head>
			<body>
				<Suspense>
					<Header />
					<Outlet />
					<SdkSetupBanner />
					<TanStackRouterDevtools />
				</Suspense>
				<Scripts />
			</body>
		</html>
	);
}
