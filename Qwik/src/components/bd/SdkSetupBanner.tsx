import { $, component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";

/**
 * Dismissable "not connected to BD yet" banner. Every surface renders with
 * local fallbacks when the BD env is missing (so the template runs
 * unconfigured) — this just points you at the setup wizard. It disappears once
 * PUBLIC_BD_SITE_ID + PUBLIC_BD_PK are set (browser-exposed via
 * Vite's envPrefix, see vite.config.ts), and can be dismissed for this browser
 * meanwhile.
 *
 * Canonical `PUBLIC_BD_*` names are preferred; the starter's original
 * `PUBLIC_BD_*` names still work as a fallback.
 */

const SITE_ID =
	(import.meta.env.PUBLIC_BD_SITE_ID as string | undefined) ??
	(import.meta.env.PUBLIC_BD_SITE_ID as string | undefined);
const PK =
	(import.meta.env.PUBLIC_BD_PK as string | undefined) ??
	(import.meta.env.PUBLIC_BD_PK as string | undefined);
const BASE_URL =
	(import.meta.env.PUBLIC_BD_PACKAGE_API_BASE_URL as
		| string
		| undefined) ??
	(import.meta.env.PUBLIC_BD_PACKAGE_API_BASE_URL as string | undefined) ??
	"https://www.biab.app";

const DISMISS_KEY = "bd-sdk-setup-banner-dismissed";

export const SdkSetupBanner = component$(() => {
	const visible = useSignal(false);

	// Start hidden (SSR) → reveal on the client when unconfigured + not dismissed
	// (localStorage is client-only). `document-ready` (not the default
	// intersection-observer) because the component renders nothing until this
	// runs, so there's no visible host element to observe.
	useVisibleTask$(
		() => {
			if (SITE_ID && PK) return; // configured — nothing to show
			if (localStorage.getItem(DISMISS_KEY) === "1") return;
			visible.value = true;
		},
		{ strategy: "document-ready" },
	);

	const dismiss$ = $(() => {
		localStorage.setItem(DISMISS_KEY, "1");
		visible.value = false;
	});

	if (!visible.value) return null;

	return (
		<div
			style={{
				position: "fixed",
				insetInline: "0",
				bottom: "0",
				zIndex: "9999",
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
			<span style={{ flex: "1 1 260px", minWidth: "0" }}>
				<strong style={{ color: "rgb(94, 234, 212)" }}>
					Not connected to BD yet.
				</strong>{" "}
				Add your <code>.env</code> to render live content — grab every variable
				(site ID, keys, revalidation secret) from the guided wizard.
			</span>
			<a
				href={`${BASE_URL}/login?returnTo=/dashboard/settings/web-content`}
				rel="noreferrer"
				target="_blank"
				style={{
					flexShrink: "0",
					borderRadius: "0.5rem",
					border: "1px solid rgba(45, 212, 191, 0.5)",
					background: "rgba(45, 212, 191, 0.12)",
					padding: "0.4rem 0.8rem",
					color: "rgb(153, 246, 228)",
					fontWeight: "600",
					textDecoration: "none",
				}}
			>
				Open setup wizard ↗
			</a>
			<button
				aria-label="Dismiss"
				onClick$={dismiss$}
				type="button"
				style={{
					flexShrink: "0",
					border: "none",
					background: "transparent",
					color: "rgba(255,255,255,0.6)",
					cursor: "pointer",
					fontSize: "1.1rem",
					lineHeight: "1",
					padding: "0.25rem",
				}}
			>
				✕
			</button>
		</div>
	);
});
