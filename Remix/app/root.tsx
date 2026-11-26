import {
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useLoaderData,
} from "react-router";
import type { LinksFunction, LoaderFunctionArgs } from "react-router";
import { useEffect } from "react";
import type { BdAnalyticsTracker } from "@businessdash/sdk/analytics-core";

import { SdkSetupBanner } from "./components/SdkSetupBanner";
import { getAnalyticsConfig } from "./lib/bd.server";
import stylesUrl from "./styles.css?url";
// SDK form styles: file-upload box, multi-step progress header, choice/
// availability chips. Required wherever `<BdForm>` renders (contact, book).
// The container background is intentionally transparent — the template owns it.
import bdFormsUrl from "@businessdash/sdk/bd-forms.css?url";
import tailwindUrl from "./tailwind.css?url"; // [bd-line:tailwind]

export const links: LinksFunction = () => [
	{ rel: "stylesheet", href: stylesUrl },
	{ rel: "stylesheet", href: bdFormsUrl },
	{ rel: "stylesheet", href: tailwindUrl }, // [bd-line:tailwind]
];

export async function loader(_: LoaderFunctionArgs) {
	return { analytics: getAnalyticsConfig() };
}

/**
 * Starts BD analytics in the browser. The config comes from the loader, so
 * the key stays out of the static bundle; the SDK module loads only when
 * there is a config.
 */
function BdAnalytics({ config }: { config: ReturnType<typeof getAnalyticsConfig> }) {
	// The loader can hand back an equal config as a new object; only a real
	// change restarts the tracker.
	const siteId = config?.siteId;
	const baseUrl = config?.baseUrl;
	const apiKey = config?.apiKey;
	useEffect(() => {
		if (!siteId || !baseUrl || !apiKey) return;
		let tracker: BdAnalyticsTracker | undefined;
		let alive = true;
		void import("@businessdash/sdk/analytics-core").then(({ initBdAnalytics }) => {
			if (alive) tracker = initBdAnalytics({ siteId, baseUrl, apiKey });
		});
		return () => {
			alive = false;
			tracker?.stop();
		};
	}, [siteId, baseUrl, apiKey]);
	return null;
}

export default function App() {
	const { analytics } = useLoaderData<typeof loader>();
	return (
		<html lang="en">
			<head>
				<meta charSet="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<Meta />
				<Links />
			</head>
			<body>
				<Outlet />
				<SdkSetupBanner />
				<ScrollRestoration />
				<Scripts />
				<BdAnalytics config={analytics} />
			</body>
		</html>
	);
}
