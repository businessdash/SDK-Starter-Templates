import { type FormEvent, useState } from "react";

import { useFollowers } from "@businessdash/sdk/react";

/**
 * Newsletter signup wired to BIAB followers.
 *
 * Unlike the rest of this template (which proxies through the Bun server so the
 * bearer key never reaches the browser), the followers/subscribe surface runs
 * directly in the browser via a **publishable token** (`pk_…`): origin-locked,
 * rate-limited, and scoped to `followers:self`. That's why this is the one
 * feature that reads `VITE_`-prefixed env (exposed to the browser bundle) rather
 * than the server-only `BIAB_*` vars in `.env.example`.
 *
 * `useFollowers` (from `@businessdash/sdk/react`) owns the per-browser
 * "already subscribed" hint (`subscribedLocally`, persisted in localStorage),
 * `join`, `leave`, `me`, and `edit`.
 *
 * Graceful fallback: when the publishable token + site id aren't set, the same
 * fields render in a "coming soon" placeholder mode so the page never breaks in
 * an unconfigured checkout. One shared component powers both the footer and the
 * about section.
 *
 * Reads the canonical browser-safe names (`VITE_BIAB_*`, exposed to the
 * bundle via `envPrefix` in vite.config.ts), falling back to the legacy
 * `VITE_BIAB_*` twins so existing setups keep working.
 */

const BIAB_PK = (import.meta.env.VITE_BIAB_PK ??
	import.meta.env.VITE_BIAB_PK) as string | undefined;
const BIAB_SITE_ID = (import.meta.env.VITE_BIAB_SITE_ID ??
	import.meta.env.VITE_BIAB_SITE_ID) as string | undefined;
const BIAB_BASE_URL = (import.meta.env.VITE_BIAB_PACKAGE_API_BASE_URL ??
	import.meta.env.VITE_BIAB_PACKAGE_API_BASE_URL) as string | undefined;
const BIAB_FOLLOWERS_ENABLED = Boolean(BIAB_PK && BIAB_SITE_ID);

export type SubscribeProps = {
	/** Heading/label shown above the field. */
	label?: string;
	placeholder?: string;
	buttonLabel?: string;
	/** Identifies where the signup happened (followers `source`); also the field id prefix. */
	source?: string;
	className?: string;
};

/** Newsletter signup. Live when the publishable token is configured, otherwise a
 *  graceful "coming soon" placeholder with the same fields. */
export function Subscribe(props: SubscribeProps) {
	if (BIAB_FOLLOWERS_ENABLED) {
		return <LiveSubscribe {...props} />;
	}
	return <PlaceholderSubscribe {...props} />;
}

/** Shared field markup (identical look in both modes), using the template's
 *  existing form primitives from index.css. */
function SubscribeFields({
	label = "Get updates in your inbox.",
	placeholder = "you@example.com",
	buttonLabel = "Subscribe",
	source = "subscribe",
	disabled = false,
	onSubmit,
}: SubscribeProps & {
	disabled?: boolean;
	onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
	return (
		<form className="subscribe__form" onSubmit={onSubmit}>
			<label className="biab-label" htmlFor={`${source}-email`}>
				{label}
			</label>
			<div className="subscribe__row">
				<input
					autoComplete="email"
					className="biab-input"
					disabled={disabled}
					id={`${source}-email`}
					name="email"
					placeholder={placeholder}
					required
					type="email"
				/>
				<button
					className="biab-btn"
					disabled={disabled}
					type="submit"
				>
					{buttonLabel}
				</button>
			</div>
		</form>
	);
}

/** Live signup → BIAB followers table via the publishable token. */
function LiveSubscribe(props: SubscribeProps) {
	const followers = useFollowers({
		token: BIAB_PK as string,
		siteId: BIAB_SITE_ID as string,
		...(BIAB_BASE_URL ? { baseUrl: BIAB_BASE_URL } : {}),
	});
	const [status, setStatus] = useState<
		"idle" | "submitting" | "done" | "error"
	>("idle");

	// Anonymous "already subscribed" hint (per-browser) — or a fresh success.
	if (followers.subscribedLocally || status === "done") {
		return (
			<p className={`subscribe__done ${props.className ?? ""}`.trim()}>
				You&apos;re subscribed — thanks!
			</p>
		);
	}

	const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const email = String(
			new FormData(event.currentTarget).get("email") ?? "",
		).trim();
		if (!email) return;
		setStatus("submitting");
		try {
			await followers.join({ email, source: props.source ?? "subscribe" });
			setStatus("done");
		} catch {
			setStatus("error");
		}
	};

	return (
		<div className={`subscribe ${props.className ?? ""}`.trim()}>
			<SubscribeFields
				{...props}
				disabled={status === "submitting"}
				onSubmit={onSubmit}
			/>
			{status === "error" ? (
				<p className="subscribe__error">
					Couldn&apos;t subscribe — please try again.
				</p>
			) : null}
		</div>
	);
}

/** Fallback when BIAB isn't configured (no publishable token). */
function PlaceholderSubscribe(props: SubscribeProps) {
	const [submitted, setSubmitted] = useState(false);
	if (submitted) {
		return (
			<p className={`subscribe__done ${props.className ?? ""}`.trim()}>
				Thanks — newsletter signup is coming soon.
			</p>
		);
	}
	return (
		<div className={`subscribe ${props.className ?? ""}`.trim()}>
			<SubscribeFields
				{...props}
				onSubmit={(event) => {
					event.preventDefault();
					setSubmitted(true);
				}}
			/>
		</div>
	);
}
