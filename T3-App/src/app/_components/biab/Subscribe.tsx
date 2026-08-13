"use client";

import { useFollowers } from "@businessdash/sdk/react";
import { type FormEvent, useState } from "react";

/**
 * Newsletter signup wired to BIAB followers via a browser-safe publishable
 * token (origin-locked, rate-limited, scoped to `followers:self` — no backend
 * needed). The same component powers the footer and the About section.
 *
 * When the publishable env isn't configured the form degrades to a "coming
 * soon" placeholder, so the template still renders in an unconfigured checkout.
 *
 * Mirrors the DGP `SubscribeStub` live-vs-placeholder split, but styled with
 * this template's `biab-*` / `subscribe-*` design-token classes.
 */

const BIAB_PK = process.env.NEXT_PUBLIC_BIAB_PK;
const BIAB_SITE_ID = process.env.NEXT_PUBLIC_BIAB_SITE_ID;
const BIAB_BASE_URL = process.env.NEXT_PUBLIC_BIAB_PACKAGE_API_BASE_URL;
const BIAB_FOLLOWERS_ENABLED = Boolean(BIAB_PK && BIAB_SITE_ID);

type SubscribeProps = {
	/** Label rendered above the field. */
	label: string;
	placeholder?: string;
	buttonLabel?: string;
	className?: string;
	/** Identifies where the signup happened ("footer" / "about"). */
	source?: string;
	idPrefix?: string;
};

/** Public entry — picks the live or placeholder variant up front. */
export function Subscribe(props: SubscribeProps) {
	if (BIAB_FOLLOWERS_ENABLED) {
		return <LiveSubscribe {...props} />;
	}
	return <PlaceholderSubscribe {...props} />;
}

/** Shared input + button markup (identical in both modes). */
function SubscribeFields({
	label,
	placeholder = "you@example.com",
	buttonLabel = "Subscribe",
	className = "",
	idPrefix = "subscribe",
	disabled = false,
	onSubmit,
}: SubscribeProps & {
	disabled?: boolean;
	onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
	return (
		<form className={`subscribe ${className}`.trim()} onSubmit={onSubmit}>
			<label className="biab-label" htmlFor={`${idPrefix}-email`}>
				{label}
			</label>
			<div className="subscribe__row">
				<input
					autoComplete="email"
					className="biab-input subscribe__input"
					disabled={disabled}
					id={`${idPrefix}-email`}
					name="email"
					placeholder={placeholder}
					required
					type="email"
				/>
				<button
					className="biab-btn subscribe__btn"
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

	// Anonymous per-browser "already subscribed" hint, or a fresh success.
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
			await followers.join({
				email,
				source: props.source ?? props.idPrefix ?? "subscribe",
			});
			setStatus("done");
		} catch {
			setStatus("error");
		}
	};

	return (
		<div className={props.className}>
			<SubscribeFields
				{...props}
				className=""
				disabled={status === "submitting"}
				onSubmit={onSubmit}
			/>
			{status === "error" ? (
				<p className="subscribe__err">
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
		<SubscribeFields
			{...props}
			onSubmit={(event) => {
				event.preventDefault();
				setSubmitted(true);
			}}
		/>
	);
}
