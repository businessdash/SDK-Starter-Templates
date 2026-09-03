import { useEffect, useState } from "react";

/**
 * Dismissable "not connected yet" banner. The template renders all its content
 * with local fallbacks when BD env is missing (so it runs unconfigured) — this
 * just tells you how to connect it. It disappears automatically once
 * VITE_BD_SITE_ID + VITE_BD_PK are set (Vite inlines them at build), and can
 * be dismissed for this browser in the meantime.
 */

// Inlined at build time by Vite. When unset, the site is running unconfigured.
const SITE_ID = import.meta.env["VITE_BD_SITE_ID"] as string | undefined;
const PK = import.meta.env["VITE_BD_PK"] as string | undefined;
const BASE_URL =
	(import.meta.env["VITE_BD_PACKAGE_API_BASE_URL"] as string | undefined) ??
	"https://www.biab.app";

const DISMISS_KEY = "bd-sdk-setup-banner-dismissed";

export function SdkSetupBanner() {
	const [hidden, setHidden] = useState(true);

	useEffect(() => {
		if (SITE_ID && PK) return; // configured — nothing to show
		if (localStorage.getItem(DISMISS_KEY) === "1") return;
		setHidden(false);
	}, []);

	if (hidden) return null;

	return (
		<div
			style={{
				position: "fixed",
				insetInline: 0,
				bottom: 0,
				zIndex: 9999,
				display: "flex",
				flexWrap: "wrap",
				alignItems: "center",
				gap: "0.75rem",
				padding: "0.75rem 1rem",
				background: "rgba(15, 23, 42, 0.96)",
				color: "white",
				borderTop: "1px solid rgba(45, 212, 191, 0.35)",
				backdropFilter: "blur(8px)",
				fontSize: "0.875rem",
			}}
		>
			<span style={{ flex: "1 1 260px", minWidth: 0 }}>
				<strong style={{ color: "rgb(94, 234, 212)" }}>
					Not connected to BD yet.
				</strong>{" "}
				Add your <code>.env</code> to render live content — grab every variable
				(site ID, keys, revalidation secret) from the guided wizard.
			</span>
			<a
				href={`${BASE_URL}/login?returnTo=/dashboard/settings/web-content`}
				rel="noreferrer"
				style={{
					flexShrink: 0,
					borderRadius: "0.5rem",
					border: "1px solid rgba(45, 212, 191, 0.5)",
					background: "rgba(45, 212, 191, 0.12)",
					padding: "0.4rem 0.8rem",
					color: "rgb(153, 246, 228)",
					fontWeight: 600,
					textDecoration: "none",
				}}
				target="_blank"
			>
				Open setup wizard ↗
			</a>
			<button
				aria-label="Dismiss"
				onClick={() => {
					localStorage.setItem(DISMISS_KEY, "1");
					setHidden(true);
				}}
				style={{
					flexShrink: 0,
					border: "none",
					background: "transparent",
					color: "rgba(255,255,255,0.6)",
					cursor: "pointer",
					fontSize: "1.1rem",
					lineHeight: 1,
					padding: "0.25rem",
				}}
				type="button"
			>
				✕
			</button>
		</div>
	);
}
