/**
 * Newsletter / followers signup — shared by the footer AND the about section
 * (mirrors the DGP `SubscribeStub`: one component, two placements).
 *
 * HTMX is fully server-rendered, so unlike the React starter (which uses the
 * browser-safe `useFollowers` hook + a publishable `pk_…` token) this template
 * joins followers SERVER-SIDE through the same configured `getBiab()` client
 * that powers every other section — `client.followers.join({ email, source })`.
 * The browser only ever sees HTML; no key, no SDK, no publishable token.
 *
 * Live-vs-placeholder split (graceful fallback):
 *   - SDK configured  → POST /sections/subscribe → followers.join → "subscribed"
 *   - SDK unconfigured → same fields, submit just shows "coming soon"
 *
 * "Already subscribed" hint: on a successful join we set a per-browser cookie
 * (`biab_follower`) and read it on render to skip straight to the confirmation —
 * the server-side analogue of what `useFollowers().subscribedLocally` does.
 */

import { getBiab } from "../biab";
import { html, raw, render, type Raw } from "../html";
import { getCookie } from "../layout";

/** Per-browser "already subscribed" hint (server-side analogue of the React
 *  hook's localStorage flag). Not httpOnly so it's purely a UI hint. */
export const FOLLOWER_COOKIE = "biab_follower";
const FOLLOWER_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export function followerSetCookie(email: string): string {
	const value = encodeURIComponent(email);
	return `${FOLLOWER_COOKIE}=${value}; Path=/; SameSite=Lax; Max-Age=${FOLLOWER_MAX_AGE}`;
}

type SubscribeOpts = {
	/** Heading/label above the email input. */
	label?: string;
	placeholder?: string;
	buttonLabel?: string;
	/** Lead-source attribution (e.g. "footer" / "about"). Also targets the swap. */
	source?: string;
	/** Extra class on the wrapper, e.g. to invert colors in the footer. */
	className?: string;
};

/** The confirmation shown once a visitor is subscribed (fresh or remembered). */
function subscribedNotice(className = ""): Raw {
	return html`<p class="subscribe__done${className ? raw(` ${escapeClass(className)}`) : ""}">You're subscribed — thanks!</p>`;
}

/** The "coming soon" notice for the placeholder (unconfigured) mode. */
function comingSoonNotice(className = ""): Raw {
	return html`<p class="subscribe__done${className ? raw(` ${escapeClass(className)}`) : ""}">Thanks — newsletter signup is coming soon.</p>`;
}

function escapeClass(s: string): string {
	return s.replace(/[^a-zA-Z0-9 _-]/g, "");
}

/** The shared form markup (identical fields in live + placeholder modes). The
 *  form swaps itself out with the confirmation via `hx-swap="outerHTML"`. */
function subscribeForm(opts: SubscribeOpts): Raw {
	const source = opts.source ?? "subscribe";
	const id = `subscribe-${escapeClass(source)}`;
	return html`<form
		class="subscribe${opts.className ? raw(` ${escapeClass(opts.className)}`) : ""}"
		hx-post="/sections/subscribe"
		hx-target="this"
		hx-swap="outerHTML"
		hx-indicator="#${id}-spin"
	>
		<label class="subscribe__label" for="${id}-email">${opts.label ?? "Subscribe to our newsletter"}</label>
		<div class="subscribe__row">
			<input
				class="subscribe__input"
				id="${id}-email"
				name="email"
				type="email"
				autocomplete="email"
				placeholder="${opts.placeholder ?? "you@example.com"}"
				required
			/>
			<input type="hidden" name="source" value="${source}" />
			<button class="btn btn--primary subscribe__btn" type="submit">
				${opts.buttonLabel ?? "Subscribe"} <span id="${id}-spin" class="htmx-indicator">…</span>
			</button>
		</div>
	</form>`;
}

/**
 * Render the subscribe block for embedding (footer + about). When the visitor
 * already subscribed in this browser (cookie set), shows the confirmation
 * instead of the form. `req` is optional so callers without a request (rare)
 * still render the form.
 */
export function renderSubscribe(opts: SubscribeOpts, req?: Request): Raw {
	if (req && getCookie(req, FOLLOWER_COOKIE)) {
		return subscribedNotice(opts.className);
	}
	return subscribeForm(opts);
}

/**
 * POST /sections/subscribe — join the visitor to the org's followers list.
 * Returns { body, setCookie } so the route can set the per-browser hint cookie
 * on success. Degrades to a "coming soon" confirmation when the SDK is unset.
 */
export async function handleSubscribe(
	req: Request,
): Promise<{ body: string; setCookie?: string; status?: number }> {
	const form = await req.formData();
	const email = String(form.get("email") ?? "").trim();
	const source = String(form.get("source") ?? "subscribe").trim() || "subscribe";
	const className = ""; // placement-specific class isn't round-tripped; keep neutral.

	if (!email) {
		return {
			body: render(html`<p class="subscribe__error">Please enter your email.</p>`),
			status: 400,
		};
	}

	const biab = getBiab();
	if (!biab) {
		// Unconfigured — acknowledge locally (placeholder mode), no cookie.
		return { body: render(comingSoonNotice(className)) };
	}

	try {
		await biab.followers.join({ email, source });
		return { body: render(subscribedNotice(className)), setCookie: followerSetCookie(email) };
	} catch (err) {
		console.error("[biab] follower join failed:", err);
		return {
			body: render(
				html`<p class="subscribe__error">Couldn't subscribe — please try again.</p>`,
			),
			status: 502,
		};
	}
}
