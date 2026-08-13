import { $, component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";

/**
 * Newsletter signup wired to BIAB followers. The same component powers the
 * footer and the about-section signups (mirrors the DGP `SubscribeStub`).
 *
 * Browser-safe by design: it joins via a PUBLISHABLE token (`pk_…`,
 * origin-locked, scope `followers:self`) using the core `createBiabClient`
 * inside a `$` handler — no backend round-trip needed. The publishable token,
 * site id, and optional base URL come from Qwik City's `PUBLIC_`-prefixed env,
 * read through `import.meta.env` so they're available client-side.
 *
 * When the publishable env isn't set the component degrades to a "coming soon"
 * placeholder so the template still runs in an unconfigured checkout.
 *
 * "Already subscribed" hint:
 *   - Anonymous → a per-browser flag in `localStorage` under
 *     `biab.followers.<siteId>` (`{ email, at }`), set after a successful join
 *     and read on mount. This mirrors what `useFollowers` does internally.
 *   - Logged-in → the authoritative source is `client.followers.me(email)`
 *     (cross-device); a starter footer/about signup stays anonymous, so the
 *     localStorage flag is the UX source of truth here. IP is deliberately NOT
 *     used.
 */

// Publishable BIAB credentials — browser-exposed via `import.meta.env`. Prefer
// the canonical `PUBLIC_BIAB_*` names (Vite envPrefix), falling back to the
// starter's original `PUBLIC_BIAB_*` names. Unset → placeholder mode (the page
// never breaks).
const BIAB_PK =
	(import.meta.env.PUBLIC_BIAB_PK as string | undefined) ??
	(import.meta.env.PUBLIC_BIAB_PK as string | undefined);
const BIAB_SITE_ID =
	(import.meta.env.PUBLIC_BIAB_SITE_ID as string | undefined) ??
	(import.meta.env.PUBLIC_BIAB_SITE_ID as string | undefined);
const BIAB_BASE_URL =
	(import.meta.env.PUBLIC_BIAB_PACKAGE_API_BASE_URL as
		| string
		| undefined) ??
	(import.meta.env.PUBLIC_BIAB_PACKAGE_API_BASE_URL as string | undefined);
const BIAB_FOLLOWERS_ENABLED = Boolean(BIAB_PK && BIAB_SITE_ID);

const FOLLOWER_STORE_PREFIX = "biab.followers.";

/** Per-browser "already subscribed?" hint — true once this browser has joined. */
function hasLocalFollow(siteId: string): boolean {
	if (typeof window === "undefined") return false;
	try {
		const raw = window.localStorage.getItem(`${FOLLOWER_STORE_PREFIX}${siteId}`);
		if (!raw) return false;
		const parsed = JSON.parse(raw) as { email?: unknown };
		return typeof parsed?.email === "string";
	} catch {
		return false;
	}
}

/** Remember the join on this browser (best-effort — storage may be disabled). */
function writeLocalFollow(siteId: string, email: string): void {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(
			`${FOLLOWER_STORE_PREFIX}${siteId}`,
			JSON.stringify({ email, at: Date.now() }),
		);
	} catch {
		// quota / disabled — the hint is best-effort.
	}
}

export type SubscribeProps = {
	/** Visible field label. */
	label: string;
	/** Email input placeholder. */
	placeholder?: string;
	/** Submit button copy. */
	buttonLabel?: string;
	/** Lead-source provenance forwarded to `followers.join`. */
	source?: string;
	/** Extra class on the wrapper. */
	class?: string;
};

export const Subscribe = component$<SubscribeProps>((props) => {
	const {
		label,
		placeholder = "you@example.com",
		buttonLabel = "Subscribe",
		source = "subscribe",
	} = props;

	const status = useSignal<"idle" | "submitting" | "done" | "error">("idle");
	const subscribedLocally = useSignal(false);

	// Read the per-browser hint on mount (client-only — localStorage isn't on
	// the server). Skips straight to the "subscribed" state for repeat visitors.
	useVisibleTask$(() => {
		if (BIAB_SITE_ID && hasLocalFollow(BIAB_SITE_ID)) {
			subscribedLocally.value = true;
		}
	});

	const onSubmit$ = $(async (event: SubmitEvent) => {
		event.preventDefault();
		const form = event.target as HTMLFormElement;
		const email = String(new FormData(form).get("email") ?? "").trim();
		if (!email) return;

		// Placeholder mode — no publishable token, so just confirm locally.
		if (!BIAB_FOLLOWERS_ENABLED) {
			status.value = "done";
			return;
		}

		status.value = "submitting";
		try {
			// Lazy-load the core client client-side so it never bloats the SSR
			// path; the publishable token is safe in the browser bundle.
			const { createBiabClient } = await import("@businessdash/sdk");
			const client = createBiabClient({
				apiKey: BIAB_PK as string,
				siteId: BIAB_SITE_ID as string,
				...(BIAB_BASE_URL ? { baseUrl: BIAB_BASE_URL } : {}),
			});
			await client.followers.join({ email, source });
			writeLocalFollow(BIAB_SITE_ID as string, email);
			status.value = "done";
		} catch {
			status.value = "error";
		}
	});

	// Already-subscribed (this browser) or a fresh success → confirmation copy.
	if (subscribedLocally.value || status.value === "done") {
		return (
			<p class={`biab-subscribe__note ${props.class ?? ""}`.trim()}>
				{BIAB_FOLLOWERS_ENABLED
					? "You're subscribed — thanks!"
					: "Thanks — newsletter signup is coming soon."}
			</p>
		);
	}

	const disabled = status.value === "submitting";

	return (
		<div class={props.class}>
			<form class="biab-subscribe" preventdefault:submit onSubmit$={onSubmit$}>
				<label class="biab-label" for={`${source}-email`}>
					{label}
				</label>
				<div class="biab-subscribe__row">
					<input
						autoComplete="email"
						class="biab-input"
						disabled={disabled}
						id={`${source}-email`}
						name="email"
						placeholder={placeholder}
						required
						type="email"
					/>
					<button class="biab-btn" disabled={disabled} type="submit">
						{disabled ? "Sending…" : buttonLabel}
					</button>
				</div>
			</form>
			{status.value === "error" ? (
				<p class="biab-subscribe__error">
					Couldn't subscribe — please try again.
				</p>
			) : null}
		</div>
	);
});
