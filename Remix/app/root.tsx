import {
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useLoaderData,
} from "react-router";
import type { LinksFunction, LoaderFunctionArgs } from "react-router";

import { SdkSetupBanner } from "./components/SdkSetupBanner";
import { getAnalyticsConfig } from "./lib/bd.server";
import stylesUrl from "./styles.css?url";
// SDK form styles: file-upload box, multi-step progress header, choice/
// availability chips. Required wherever `<BdForm>` renders (contact, book).
// The container background is intentionally transparent — the template owns it.
import bdFormsUrl from "@businessdash/sdk/bd-forms.css?url";

export const links: LinksFunction = () => [
	{ rel: "stylesheet", href: stylesUrl },
	{ rel: "stylesheet", href: bdFormsUrl },
];

export async function loader(_: LoaderFunctionArgs) {
	return { analytics: getAnalyticsConfig() };
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
				{analytics ? (
					<script
						// Server-known config inlined so the public key never lives
						// in the static client bundle. The dynamic-import below
						// reads it after hydration.
						dangerouslySetInnerHTML={{
							__html: `window.__BD_ANALYTICS__=${JSON.stringify(analytics)};`,
						}}
					/>
				) : null}
				<script
					type="module"
					dangerouslySetInnerHTML={{
						__html: `
							const cfg = window.__BD_ANALYTICS__;
							if (cfg && cfg.siteId && cfg.baseUrl && cfg.apiKey) {
								import("@businessdash/sdk/analytics-core").then(({ initBdAnalytics }) => {
									initBdAnalytics({
										siteId: cfg.siteId,
										baseUrl: cfg.baseUrl,
										apiKey: cfg.apiKey,
									});
								});
							}
						`,
					}}
				/>
			</body>
		</html>
	);
}
