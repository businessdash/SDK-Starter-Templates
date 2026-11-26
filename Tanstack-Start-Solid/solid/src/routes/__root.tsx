import { type QueryClient, QueryClientProvider } from "@tanstack/solid-query";
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
import { HydrationScript } from "@solidjs/web";
import { Loading, onSettled } from "solid-js";
// [bd:blog]
// The blog's styles: post list, post body, likes and comments.
import blogCss from "../bd-blog.css?url";
// [/bd:blog]
// The reviews page's styles: the rating, the filter, the reviews, writing one.
import reviewsCss from "../bd-reviews.css?url";
// [bd:store]
// The shop's styles: store grid, product page, wishlist, compare.
import shopCss from "../bd-shop.css?url";
// [/bd:store]
import { SdkSetupBanner } from "../components/bd/SdkSetupBanner";
import Header from "../components/Header";
import styleCss from "../styles.css?url";
import tailwindCss from "../tailwind.css?url"; // [bd-line:tailwind]

/** What src/router.tsx puts in every route's context. */
interface RouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
	head: () => ({
		links: [
			{ rel: "stylesheet", href: styleCss },
			{ rel: "stylesheet", href: shopCss }, // [bd-line:store]
			{ rel: "stylesheet", href: blogCss }, // [bd-line:blog]
			{ rel: "stylesheet", href: reviewsCss },
			{ rel: "stylesheet", href: tailwindCss }, // [bd-line:tailwind]
		],
	}),
	shellComponent: RootComponent,
});

function RootComponent() {
	const context = Route.useRouteContext();
	// Solid 2: `onSettled` replaces `onMount` and takes its cleanup as the
	// return value, so the tracker stops when the shell unmounts.
	onSettled(() => {
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
		return () => tracker.stop();
	});

	return (
		<html lang="en">
			<head>
				<HydrationScript />
				<HeadContent />
			</head>
			<body>
				{/* The router's query client, for useQuery in any route. */}
				<QueryClientProvider client={context().queryClient}>
					<Loading>
						<Header />
						<Outlet />
						<SdkSetupBanner />
						<TanStackRouterDevtools />
					</Loading>
				</QueryClientProvider>
				<Scripts />
			</body>
		</html>
	);
}
