import { createSignal, onMount, Show } from "solid-js";

/**
 * Dismissable "not connected yet" banner. The template renders all its content
 * with local fallbacks when BD env is missing (so it runs unconfigured) —
 * this just tells you how to connect it. It disappears automatically once the
 * browser-safe BD config (site id + publishable token) is set, and can be
 * dismissed for this browser in the meantime.
 *
 * Reads the canonical `VITE_BD_*` names (exposed to the browser via
 * `envPrefix` in vite.config.ts), falling back to the legacy `VITE_BD_*`
 * twins so existing setups keep working. The config check runs in `onMount`
 * (client only), so the server render + hydration stay in sync.
 */

// Inlined at build time. When unset, the site is running unconfigured.
const SITE_ID = (import.meta.env.VITE_BD_SITE_ID ??
	import.meta.env.VITE_BD_SITE_ID) as string | undefined;
const PK = (import.meta.env.VITE_BD_PK ??
	import.meta.env.VITE_BD_PUBLIC_KEY) as string | undefined;
const BASE_URL =
	((import.meta.env.VITE_BD_PACKAGE_API_BASE_URL ??
		import.meta.env.VITE_BD_PACKAGE_API_BASE_URL) as string | undefined) ??
	"https://www.biab.app";

const DISMISS_KEY = "bd-sdk-setup-banner-dismissed";

export function SdkSetupBanner() {
	const [visible, setVisible] = createSignal(false);

	onMount(() => {
		if (SITE_ID && PK) return; // configured — nothing to show
		if (localStorage.getItem(DISMISS_KEY) === "1") return;
		setVisible(true);
	});

	const dismiss = () => {
		try {
			localStorage.setItem(DISMISS_KEY, "1");
		} catch {
			// storage disabled / quota — best-effort.
		}
		setVisible(false);
	};

	return (
		<Show when={visible()}>
			<div
				style={{
					position: "fixed",
					left: "0",
					right: "0",
					bottom: "0",
					"z-index": "9999",
					display: "flex",
					"flex-wrap": "wrap",
					"align-items": "center",
					gap: "0.75rem",
					padding: "0.75rem 1rem",
					background: "rgba(15, 23, 42, 0.96)",
					color: "white",
					"border-top": "1px solid rgba(45, 212, 191, 0.35)",
					"backdrop-filter": "blur(8px)",
					"font-size": "0.875rem",
				}}
			>
				<span style={{ flex: "1 1 260px", "min-width": "0" }}>
					<strong style={{ color: "rgb(94, 234, 212)" }}>
						Not connected to BD yet.
					</strong>{" "}
					Add your <code>.env</code> to render live content — grab every
					variable (site ID, keys, revalidation secret) from the guided wizard.
				</span>
				<a
					href={`${BASE_URL}/login?returnTo=/dashboard/settings/web-content`}
					rel="noreferrer"
					target="_blank"
					style={{
						"flex-shrink": "0",
						"border-radius": "0.5rem",
						border: "1px solid rgba(45, 212, 191, 0.5)",
						background: "rgba(45, 212, 191, 0.12)",
						padding: "0.4rem 0.8rem",
						color: "rgb(153, 246, 228)",
						"font-weight": "600",
						"text-decoration": "none",
					}}
				>
					Open setup wizard ↗
				</a>
				<button
					type="button"
					aria-label="Dismiss"
					onClick={dismiss}
					style={{
						"flex-shrink": "0",
						border: "none",
						background: "transparent",
						color: "rgba(255,255,255,0.6)",
						cursor: "pointer",
						"font-size": "1.1rem",
						"line-height": "1",
						padding: "0.25rem",
					}}
				>
					✕
				</button>
			</div>
		</Show>
	);
}
