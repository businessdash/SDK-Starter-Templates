import { useFollowers } from "@businessdash/sdk/react";
import { type FormEvent, useState } from "react";

/**
 * Newsletter / follower signup (client island).
 *
 * Wired to BD followers via a **publishable** token (`pk_…`, origin-locked,
 * rate-limited, scoped to `followers:self`) so it works browser-side with no
 * backend. Remix runs on Vite, so the browser-exposed env is `VITE_`-prefixed
 * and read from `import.meta.env`.
 *
 * One shared component powers BOTH the footer and the about section (mirrors the
 * DGP `SubscribeStub`). When the publishable env is unset it falls back to a
 * "coming soon" placeholder so the template still runs in an unconfigured
 * checkout — same fields, no live calls.
 */

const BD_PK = import.meta.env["VITE_BD_PK"] as string | undefined;
const BD_SITE_ID = import.meta.env["VITE_BD_SITE_ID"] as string | undefined;
const BD_BASE_URL = import.meta.env["VITE_BD_PACKAGE_API_BASE_URL"] as
	| string
	| undefined;
const BD_FOLLOWERS_ENABLED = Boolean(BD_PK && BD_SITE_ID);

type SubscribeProps = {
	/** Visible label above the email field. */
	label?: string;
	placeholder?: string;
	buttonLabel?: string;
	/** Distinguishes which signup converted ("footer" vs "about"). */
	source?: string;
};

/** Public entry — picks the live or placeholder variant by env presence. */
export function Subscribe(props: SubscribeProps) {
	if (BD_FOLLOWERS_ENABLED) return <LiveSubscribe {...props} />;
	return <PlaceholderSubscribe {...props} />;
}

/** Shared input + button markup (identical look in both modes). */
function SubscribeFields({
	label = "Subscribe for updates",
	placeholder = "you@example.com",
	buttonLabel = "Subscribe",
	source = "subscribe",
	disabled = false,
	onSubmit,
}: SubscribeProps & {
	disabled?: boolean;
	onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
	const id = `${source}-email`;
	return (
		<form className="subscribe" onSubmit={onSubmit}>
			<label htmlFor={id}>{label}</label>
			<div className="subscribe__row">
				<input
					autoComplete="email"
					disabled={disabled}
					id={id}
					name="email"
					placeholder={placeholder}
					required
					type="email"
				/>
				<button className="bd-btn" disabled={disabled} type="submit">
					{disabled ? "Sending…" : buttonLabel}
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
		return <p className="subscribe__done">You're subscribed — thanks!</p>;
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
		<div className="subscribe-wrap">
			<SubscribeFields
				{...props}
				disabled={status === "submitting"}
				onSubmit={onSubmit}
			/>
			{status === "error" ? (
				<p className="error">Couldn't subscribe — please try again.</p>
			) : null}
		</div>
	);
}

/** Fallback when BD isn't configured (no publishable token). */
function PlaceholderSubscribe(props: SubscribeProps) {
	const [submitted, setSubmitted] = useState(false);
	if (submitted) {
		return (
			<p className="subscribe__done">
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
