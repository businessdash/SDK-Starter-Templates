/**
 * Setup banner — a dismissable "not connected to BIAB yet" bar (fixed bottom).
 *
 * This is NOT the news banner (`banner.js`, which renders `bundle.banner`). This
 * one only appears until the site is wired to BIAB and tells you how to connect
 * it. It reads `window.__BIAB_PUBLIC__` (the publishable config the Bun server
 * injects) and stays hidden once BIAB_SITE_ID + BIAB_PK
 * are set. Dismiss persists to the localStorage key
 * "biab-sdk-setup-banner-dismissed".
 */

import { el } from "/biab.js";

const DISMISS_KEY = "biab-sdk-setup-banner-dismissed";

/** Mount the setup banner into `root` (defaults to <body>). No-op when the site
 *  is configured or the banner was already dismissed this browser. */
export function mountSetupBanner(root = document.body) {
	const cfg = (typeof window !== "undefined" && window.__BIAB_PUBLIC__) || null;
	if (cfg && cfg.siteId && cfg.pk) return; // connected — nothing to show
	try {
		if (localStorage.getItem(DISMISS_KEY) === "1") return;
	} catch {
		/* ignore storage failures */
	}

	// Strip the package path so the link points at the dashboard host root.
	const base =
		(cfg && cfg.baseUrl
			? String(cfg.baseUrl).replace(/\/api\/package\/v1\/?$/, "")
			: "") || "https://www.biab.app";
	const wizardUrl = `${base.replace(/\/+$/, "")}/login?returnTo=/dashboard/settings/web-content`;

	const bar = el(
		"div",
		{
			class: "biab-setup-banner",
			role: "region",
			"aria-label": "BIAB setup",
			style:
				"position:fixed;inset-inline:0;bottom:0;z-index:9999;display:flex;flex-wrap:wrap;align-items:center;gap:0.75rem;padding:0.75rem 1rem;background:#08060d;color:#fff;border-top:1px solid var(--accent,#6033b8);font-size:0.875rem;",
		},
		[
			el("span", {
				style: "flex:1 1 260px;min-width:0;",
				html:
					'<strong style="color:#c4b5fd;">Not connected to BIAB yet.</strong> Add your <code>.env.local</code> to render live content — grab every variable from the guided wizard.',
			}),
			el(
				"a",
				{
					href: wizardUrl,
					target: "_blank",
					rel: "noreferrer",
					style:
						"flex-shrink:0;border-radius:0.5rem;border:1px solid var(--accent,#6033b8);background:rgba(96,51,184,0.18);padding:0.4rem 0.8rem;color:#ddd6fe;font-weight:600;text-decoration:none;",
				},
				["Open setup wizard ↗"],
			),
			el(
				"button",
				{
					type: "button",
					"aria-label": "Dismiss",
					style:
						"flex-shrink:0;border:none;background:transparent;color:rgba(255,255,255,0.6);cursor:pointer;font-size:1.1rem;line-height:1;padding:0.25rem;",
					onClick: () => {
						try {
							localStorage.setItem(DISMISS_KEY, "1");
						} catch {
							/* ignore */
						}
						bar.remove();
					},
				},
				["✕"],
			),
		],
	);
	(root || document.body).append(bar);
}
