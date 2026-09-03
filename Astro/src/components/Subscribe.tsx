import { useFollowers } from "@businessdash/sdk/react";
import { type FormEvent, useState } from "react";

/**
 * Newsletter signup as a React island.
 *
 * Followers run browser-side off a publishable token (`pk_…`, origin-locked,
 * public `followers:self` scope only) — no backend needed, which is why this is
 * a `client:load` island rather than a server-rendered `.astro` section. The
 * same component powers the footer and the about-section signups (mirrors DGP's
 * `SubscribeStub` — one shared component used in two places).
 *
 * Astro inlines `PUBLIC_`-prefixed env into the client bundle, so the browser
 * reads the publishable creds directly:
 *
 *     ---
 *     import Subscribe from "../components/Subscribe.tsx";
 *     ---
 *     <Subscribe client:load idPrefix="footer" label="Get updates" />
 *
 * ── Activation ──────────────────────────────────────────────────────────────
 * Like `ContactForm.tsx`, this island needs React, which the base Astro starter
 * doesn't bundle. Enable it once (touches package.json + astro.config, kept as a
 * consumer choice):
 *
 *     npx astro add react
 *
 * Until then the page uses the vanilla `Subscribe.astro` island instead.
 *
 * ── Graceful fallback ───────────────────────────────────────────────────────
 * When the publishable creds are unset (an unconfigured checkout), the form
 * degrades to a "coming soon" placeholder so the page never breaks.
 */

const BD_PK = import.meta.env.PUBLIC_BD_PK as string | undefined;
const BD_SITE_ID = import.meta.env.PUBLIC_BD_SITE_ID as string | undefined;
const BD_BASE_URL = import.meta.env.PUBLIC_BD_PACKAGE_API_BASE_URL as
	| string
	| undefined;
const BD_FOLLOWERS_ENABLED = Boolean(BD_PK && BD_SITE_ID);

type SubscribeProps = {
	/** Field label above the email input. */
	label?: string;
	placeholder?: string;
	buttonLabel?: string;
	className?: string;
	/** Unique id seed so multiple instances (footer + about) don't collide,
	 *  and the follower `source` tag for attribution. */
	idPrefix?: string;
};

/** Newsletter signup. Wired to BD followers via the publishable token; the
 *  same component powers the footer and the about-section signups. */
export default function Subscribe(props: SubscribeProps) {
	if (BD_FOLLOWERS_ENABLED) {
		return <LiveSubscribe {...props} />;
	}
	return <PlaceholderSubscribe {...props} />;
}

/** Shared input + button markup (identical look in both modes), styled with the
 *  template's `bd-*` light-DOM classes. */
function SubscribeFields({
	label = "Subscribe to our newsletter",
	placeholder = "you@example.com",
	buttonLabel = "Subscribe",
	idPrefix = "subscribe",
	disabled = false,
	onSubmit,
}: SubscribeProps & {
	disabled?: boolean;
	onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
	return (
		<form className="subscribe" onSubmit={onSubmit}>
			<label className="bd-label" htmlFor={`${idPrefix}-email`}>
				{label}
			</label>
			<div className="subscribe__row">
				<input
					autoComplete="email"
					className="bd-input"
					disabled={disabled}
					id={`${idPrefix}-email`}
					name="email"
					placeholder={placeholder}
					required
					type="email"
				/>
				<button className="bd-btn" disabled={disabled} type="submit">
					{disabled ? "…" : buttonLabel}
				</button>
			</div>
		</form>
	);
}

/** Live signup → BD followers table via the publishable token. */
function LiveSubscribe(props: SubscribeProps) {
	const followers = useFollowers({
		token: BD_PK as string,
		siteId: BD_SITE_ID as string,
		...(BD_BASE_URL ? { baseUrl: BD_BASE_URL } : {}),
	});
	const [status, setStatus] = useState<
		"idle" | "submitting" | "done" | "error"
	>("idle");

	// Anonymous "already subscribed" hint (per-browser) — or a fresh success.
	if (followers.subscribedLocally || status === "done") {
		return (
			<p className={`subscribe__note ${props.className ?? ""}`.trim()}>
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
			await followers.join({ email, source: props.idPrefix ?? "subscribe" });
			setStatus("done");
		} catch {
			setStatus("error");
		}
	};

	return (
		<div className={props.className}>
			<SubscribeFields
				{...props}
				disabled={status === "submitting"}
				onSubmit={onSubmit}
			/>
			{status === "error" && (
				<p className="subscribe__note subscribe__note--error">
					Couldn&apos;t subscribe — please try again.
				</p>
			)}
		</div>
	);
}

/** Fallback when BD isn't configured (no publishable token). */
function PlaceholderSubscribe(props: SubscribeProps) {
	const [submitted, setSubmitted] = useState(false);
	if (submitted) {
		return (
			<p className={`subscribe__note ${props.className ?? ""}`.trim()}>
				Thanks — newsletter signup is coming soon.
			</p>
		);
	}
	return (
		<div className={props.className}>
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
