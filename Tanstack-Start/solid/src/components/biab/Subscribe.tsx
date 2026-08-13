import { createBiabClient } from "@businessdash/sdk";
import { createMemo, createSignal, onMount, Show } from "solid-js";

/**
 * Newsletter signup wired to BIAB followers.
 *
 * Browser-safe by design: it runs on a BIAB *publishable* token (origin-locked,
 * rate-limited, `followers:self` only) — never the server-side secret key. The
 * three browser-exposed env vars are the same trio the analytics tracker uses
 * in `__root.tsx`: the canonical `VITE_BIAB_*` names (exposed to the
 * bundle via `envPrefix` in vite.config.ts), falling back to the legacy
 * `VITE_BIAB_*` twins so existing setups keep working.
 *
 * Solid has no `useFollowers` hook (that's the React adapter), so this talks to
 * the core client's `followers` resource directly and re-implements the same
 * per-browser "already subscribed" hint the hook keeps internally: a
 * `localStorage` flag under `biab.followers.<siteId>`, written on a successful
 * `join` and read on mount.
 *
 * Graceful fallback (golden rule #2): when the publishable token or site id is
 * unset the component renders a placeholder that POSTs nowhere and just shows a
 * "coming soon" note, so the page still works in an unconfigured checkout. One
 * shared component powers both the footer and the home about block.
 */

const BIAB_PK = (import.meta.env.VITE_BIAB_PK ??
	import.meta.env.VITE_BIAB_PUBLIC_KEY) as string | undefined;
const BIAB_SITE_ID = (import.meta.env.VITE_BIAB_SITE_ID ??
	import.meta.env.VITE_BIAB_SITE_ID) as string | undefined;
const BIAB_BASE_URL = (import.meta.env.VITE_BIAB_PACKAGE_API_BASE_URL ??
	import.meta.env.VITE_BIAB_PACKAGE_API_BASE_URL) as string | undefined;
const BIAB_FOLLOWERS_ENABLED = Boolean(BIAB_PK && BIAB_SITE_ID);

const FOLLOWER_STORE_PREFIX = "biab.followers.";

type LocalFollow = { email: string; at: number };

/** `createBiabClient` concatenates `baseUrl` + path verbatim, so the base must
 *  already carry the `/api/package/v1` suffix. The template's
 *  `VITE_BIAB_PACKAGE_API_BASE_URL` is a bare host (e.g. https://www.biab.app),
 *  so normalize it here — mirrors `normalizeBaseUrl` in `src/lib/biab.ts`. */
function normalizeBaseUrl(input: string): string {
	const next = input.trim().replace(/\/+$/, "");
	if (next.endsWith("/api/package/v1")) return next;
	return `${next}/api/package/v1`;
}

function readLocalFollow(key: string): LocalFollow | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = window.localStorage.getItem(key);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<LocalFollow>;
		return typeof parsed?.email === "string"
			? { email: parsed.email, at: Number(parsed.at) || 0 }
			: null;
	} catch {
		return null;
	}
}

function writeLocalFollow(key: string, value: LocalFollow): void {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// storage disabled / quota — the local hint is best-effort.
	}
}

export type SubscribeProps = {
	label?: string;
	placeholder?: string;
	buttonLabel?: string;
	/** Extra class on the wrapping element. */
	class?: string;
	/** `source` tag persisted on the follower row + id-prefix for field ids. */
	source?: string;
};

/** Public entry — live signup when configured, placeholder otherwise. */
export function Subscribe(props: SubscribeProps) {
	return (
		<Show
			when={BIAB_FOLLOWERS_ENABLED}
			fallback={<PlaceholderSubscribe {...props} />}
		>
			<LiveSubscribe {...props} />
		</Show>
	);
}

/** Shared input + button markup (identical look in both modes). */
function SubscribeFields(
	props: SubscribeProps & {
		disabled?: boolean;
		onSubmit: (event: SubmitEvent) => void;
	},
) {
	const idPrefix = () => props.source ?? "subscribe";
	const label = () => props.label ?? "Get updates in your inbox";
	const placeholder = () => props.placeholder ?? "you@example.com";
	const buttonLabel = () => props.buttonLabel ?? "Subscribe";
	return (
		<form class="biab-subscribe" onSubmit={props.onSubmit}>
			<label class="biab-label" for={`${idPrefix()}-email`}>
				{label()}
			</label>
			<div class="biab-subscribe__row">
				<input
					autocomplete="email"
					class="biab-input"
					disabled={props.disabled}
					id={`${idPrefix()}-email`}
					name="email"
					placeholder={placeholder()}
					required
					type="email"
				/>
				<button class="biab-btn" disabled={props.disabled} type="submit">
					{buttonLabel()}
				</button>
			</div>
		</form>
	);
}

/** Live signup → BIAB followers table via the publishable token. */
function LiveSubscribe(props: SubscribeProps) {
	const storeKey = `${FOLLOWER_STORE_PREFIX}${BIAB_SITE_ID}`;
	const client = createMemo(() =>
		createBiabClient({
			apiKey: BIAB_PK as string,
			siteId: BIAB_SITE_ID as string,
			...(BIAB_BASE_URL ? { baseUrl: normalizeBaseUrl(BIAB_BASE_URL) } : {}),
		}),
	);

	// Anonymous "already subscribed" hint (per-browser). Read on mount so SSR and
	// the first client paint agree (localStorage is unavailable during SSR).
	const [subscribedLocally, setSubscribedLocally] = createSignal(false);
	onMount(() => setSubscribedLocally(readLocalFollow(storeKey) !== null));

	const [status, setStatus] = createSignal<
		"idle" | "submitting" | "done" | "error"
	>("idle");

	const onSubmit = async (event: SubmitEvent) => {
		event.preventDefault();
		const form = event.currentTarget as HTMLFormElement;
		const email = String(new FormData(form).get("email") ?? "").trim();
		if (!email) return;
		setStatus("submitting");
		try {
			await client().followers.join({
				email,
				source: props.source ?? "subscribe",
			});
			writeLocalFollow(storeKey, { email, at: Date.now() });
			setSubscribedLocally(true);
			setStatus("done");
		} catch {
			setStatus("error");
		}
	};

	return (
		<Show
			when={!(subscribedLocally() || status() === "done")}
			fallback={
				<p class={`biab-subscribe__note ${props.class ?? ""}`.trim()}>
					You're subscribed — thanks!
				</p>
			}
		>
			<div class={props.class}>
				<SubscribeFields
					{...props}
					disabled={status() === "submitting"}
					onSubmit={onSubmit}
				/>
				<Show when={status() === "error"}>
					<p class="biab-subscribe__error">
						Couldn't subscribe — please try again.
					</p>
				</Show>
			</div>
		</Show>
	);
}

/** Fallback when BIAB isn't configured (no publishable token). */
function PlaceholderSubscribe(props: SubscribeProps) {
	const [submitted, setSubmitted] = createSignal(false);
	return (
		<Show
			when={!submitted()}
			fallback={
				<p class={`biab-subscribe__note ${props.class ?? ""}`.trim()}>
					Thanks — newsletter signup is coming soon.
				</p>
			}
		>
			<div class={props.class}>
				<SubscribeFields
					{...props}
					onSubmit={(event) => {
						event.preventDefault();
						setSubmitted(true);
					}}
				/>
			</div>
		</Show>
	);
}
