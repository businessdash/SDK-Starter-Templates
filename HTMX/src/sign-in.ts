/**
 * The business's sign-in screen, rendered on this server — the HTMX way.
 *
 * The same screen every BD starter shows (`<BdSignIn>`, Swift's
 * `BdSignInView`, Kotlin's `:bd-sign-in`): the business's logo, name and
 * brand colours, email and password, a new account confirmed by a 6-digit
 * emailed code, a forgotten password reset by code, and "Continue with
 * Google / Apple / GitHub / Discord". Its words, checks and colours come from
 * `@businessdash/sdk/sign-in-core`, so they match the others exactly.
 *
 * Nothing here signs anyone in by itself. Every step goes through this app's
 * own `createAuthHandler` (`/api/bd-auth/customer/*`, see `src/bd.ts`), which
 * forwards to BD with the server's key; BD runs it through WorkOS and the
 * handler sets the httpOnly `bd_session` cookie. "Continue with …" is a plain
 * link to the handler's `customer/oauth/{provider}` route.
 *
 * How it behaves in the browser:
 *   • leaving a box you typed in checks it (`hx-post` to /my-account/sign-in/check),
 *     and a box marked wrong is re-checked as you type until it's right;
 *   • pressing the button checks every box here first and sends nothing until
 *     they're right; BD's own answers about a box (a weak password, a wrong
 *     code) land under that box, the rest above the button;
 *   • it all works without JavaScript too, as a plain form post.
 *
 * Between requests, the code step's details (BD's pending id, and what's
 * needed to send a new code) travel in one hidden field, sealed with
 * AES-GCM under a key derived from this server's BD key — the browser can't
 * read or change them.
 */

import { BD_SIGN_IN_CSS } from "@businessdash/sdk/sign-in";
import {
	BD_OAUTH_PROVIDERS,
	type BdOAuthProvider,
	type BdSignInField,
	type BdSignInOptions,
	DEFAULT_SIGN_IN_STRINGS,
	signInPalette,
	validateSignInField,
} from "@businessdash/sdk/sign-in-core";

import { API_KEY, authHandler } from "./bd";
import { html, raw, render, type Raw } from "./html";

const S = DEFAULT_SIGN_IN_STRINGS;

/** Where the screen lives and where a finished sign-in lands. */
export const SIGN_IN_PATH = "/my-account";
const POST_PATH = `${SIGN_IN_PATH}/sign-in`;
const CHECK_PATH = `${SIGN_IN_PATH}/sign-in/check`;
const ID = "bd-sign-in";

type Step = "signIn" | "createAccount" | "forgot" | "code";
type Purpose = "signUp" | "reset" | "verify";
const STEPS: readonly Step[] = ["signIn", "createAccount", "forgot", "code"];
const FIELDS: readonly BdSignInField[] = ["firstName", "lastName", "email", "password", "code", "newPassword"];

/** The code step's details, sealed into the form between requests. */
type Pending = {
	pendingId: string;
	purpose: Purpose;
	email: string;
	/** To send a new code: sign-up and "confirm your email" re-send with the password. */
	password: string | null;
	firstName: string | null;
	lastName: string | null;
	/** Epoch ms after which the sealed details are refused. */
	exp: number;
};

type View = {
	step: Step;
	pending: Pending | null;
	sealed: string | null;
	values: Partial<Record<BdSignInField, string>>;
	errors: Partial<Record<BdSignInField, string>>;
	problem: string | null;
	notice: string | null;
	focus: BdSignInField | null;
	options: BdSignInOptions;
	/** Where a finished sign-in goes instead of the account page (`?next=`, e.g. a quiz invitation). */
	next: string | null;
};

/** `next` when it's a path on this site, else null — never another site. */
export function safeNext(value: unknown): string | null {
	if (typeof value !== "string" || value.length > 512) return null;
	return value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : null;
}

/** Back here with `next` kept, so a provider's refusal still shows this screen. */
function accountPath(next: string | null): string {
	return next ? `${SIGN_IN_PATH}?next=${encodeURIComponent(next)}` : SIGN_IN_PATH;
}

// ── BD, through this app's auth handler ──────────────────────────────

type Answer =
	| { ok: true; body: Record<string, unknown>; cookie: string | null }
	| { ok: false; code: string; message: string };

const UNAVAILABLE = { ok: false, code: "unavailable", message: "Sign-in isn't available just now. Try again in a minute." } as const;

/** One `customer/*` call through `createAuthHandler`, as the SDK's screen makes it. */
async function customer(origin: string, path: string, body?: Record<string, unknown>): Promise<Answer> {
	if (!authHandler) return UNAVAILABLE;
	const request = new Request(`${origin}/api/bd-auth/customer/${path}`, body === undefined
		? { method: "GET", headers: { Accept: "application/json" } }
		: { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(body) });
	let response: Response;
	try {
		response = await (body === undefined ? authHandler.GET(request) : authHandler.POST(request));
	} catch {
		return UNAVAILABLE;
	}
	const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
	if (!response.ok) {
		if (data && typeof data.message === "string" && data.message.trim()) {
			return { ok: false, code: typeof data.error === "string" ? data.error : "failed", message: data.message };
		}
		return response.status === 429
			? { ok: false, code: "too_many_tries", message: "That's a lot of tries. Wait a few minutes, then try again." }
			: UNAVAILABLE;
	}
	if (!data || typeof data !== "object") return UNAVAILABLE;
	return { ok: true, body: data, cookie: response.headers.get("Set-Cookie") };
}

const NO_OPTIONS: BdSignInOptions = { name: null, password: true, apple: false, google: false };
let optionsCache: { at: number; value: BdSignInOptions } | null = null;

/** The business's name, logo, colours and providers — asked once a minute. */
async function loadOptions(origin: string): Promise<BdSignInOptions> {
	if (optionsCache && Date.now() - optionsCache.at < 60_000) return optionsCache.value;
	const answer = await customer(origin, "options");
	if (!answer.ok) return optionsCache?.value ?? NO_OPTIONS;
	optionsCache = { at: Date.now(), value: answer.body as unknown as BdSignInOptions };
	return optionsCache.value;
}

/** BD's answers that are about one box go under that box (as the SDK's controller does). */
function fieldFor(code: string, shown: BdSignInField[]): BdSignInField | null {
	const pick = (...candidates: BdSignInField[]) => candidates.find((f) => shown.includes(f)) ?? null;
	switch (code) {
		case "weak_password":
		case "password_too_short":
			return pick("newPassword", "password");
		case "invalid_code":
		case "code_expired":
			return pick("code");
		case "invalid_email":
			return pick("email");
		default:
			return null;
	}
}

// ── Sealed code-step details ─────────────────────────────────────────

let keyPromise: Promise<CryptoKey> | null = null;
function stateKey(): Promise<CryptoKey> {
	keyPromise ??= crypto.subtle
		.digest("SHA-256", new TextEncoder().encode(`bd-sign-in-state:${API_KEY ?? ""}`))
		.then((bytes) => crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]));
	return keyPromise;
}

async function seal(pending: Pending): Promise<string> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const sealed = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		await stateKey(),
		new TextEncoder().encode(JSON.stringify(pending)),
	);
	return `${Buffer.from(iv).toString("base64url")}.${Buffer.from(sealed).toString("base64url")}`;
}

async function unseal(value: string | null): Promise<Pending | null> {
	if (!value) return null;
	const [iv, body] = value.split(".");
	if (!iv || !body) return null;
	try {
		const opened = await crypto.subtle.decrypt(
			{ name: "AES-GCM", iv: Buffer.from(iv, "base64url") },
			await stateKey(),
			Buffer.from(body, "base64url"),
		);
		const pending = JSON.parse(new TextDecoder().decode(opened)) as Pending;
		return pending.exp > Date.now() ? pending : null;
	} catch {
		return null;
	}
}

function pendingFrom(sent: Record<string, unknown>, details: Omit<Pending, "pendingId" | "exp">): Pending | null {
	if (typeof sent.pendingId !== "string") return null;
	const expires = typeof sent.expiresAt === "string" ? Date.parse(sent.expiresAt) : Number.NaN;
	return {
		...details,
		pendingId: sent.pendingId,
		exp: Number.isFinite(expires) ? expires : Date.now() + 15 * 60_000,
	};
}

// ── What each step shows (the SDK controller's `build`) ───────────────

function fieldsFor(view: Pick<View, "step" | "pending">): BdSignInField[] {
	switch (view.step) {
		case "signIn":
			return ["email", "password"];
		case "createAccount":
			return ["firstName", "lastName", "email", "password"];
		case "forgot":
			return ["email"];
		case "code":
			return view.pending?.purpose === "reset" ? ["code", "newPassword"] : ["code"];
	}
}

const fill = (template: string, values: Record<string, string>) =>
	template.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);

const SPEC: Record<BdSignInField, { type: string; autocomplete: string; inputmode?: string; label: string }> = {
	firstName: { type: "text", autocomplete: "given-name", label: S.firstName },
	lastName: { type: "text", autocomplete: "family-name", label: S.lastName },
	email: { type: "email", autocomplete: "email", inputmode: "email", label: S.email },
	password: { type: "password", autocomplete: "current-password", label: S.password },
	code: { type: "text", autocomplete: "one-time-code", inputmode: "numeric", label: S.code },
	newPassword: { type: "password", autocomplete: "new-password", label: S.newPassword },
};

const PROVIDER_LABEL: Record<BdOAuthProvider, string> = {
	apple: S.continueWithApple,
	google: S.continueWithGoogle,
	github: S.continueWithGitHub,
	discord: S.continueWithDiscord,
};

/** The same marks the SDK's screen uses. */
const PROVIDER_MARK: Record<BdOAuthProvider, string> = {
	apple: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76-1.47.02-2.83.86-3.59 2.18-1.53 2.66-.39 6.6 1.1 8.75.73 1.05 1.6 2.24 2.73 2.2 1.1-.05 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.4 1.2-2.46-.03-.01-2.3-.88-2.32-3.5zM14.2 6.13c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.3-.56.64-1.05 1.67-.92 2.66.97.08 1.96-.49 2.56-1.2z"/></svg>',
	github: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.17 1.18a10.9 10.9 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z"/></svg>',
	discord: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="#5865F2"><path d="M20.32 4.37A19.8 19.8 0 0 0 15.39 2.8a13.7 13.7 0 0 0-.63 1.29 18.4 18.4 0 0 0-5.52 0 13 13 0 0 0-.64-1.29 19.7 19.7 0 0 0-4.93 1.53C.53 9.05-.32 13.6.1 18.09a19.9 19.9 0 0 0 6.04 3.05c.49-.66.92-1.36 1.29-2.1a12.9 12.9 0 0 1-2.03-.97l.5-.38a14.2 14.2 0 0 0 12.2 0l.5.38c-.65.38-1.33.71-2.04.97.37.74.8 1.44 1.29 2.1a19.9 19.9 0 0 0 6.05-3.05c.5-5.2-.84-9.71-3.58-13.72zM8.02 15.33c-1.18 0-2.16-1.09-2.16-2.42s.96-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.33-.96 2.42-2.16 2.42zm7.96 0c-1.18 0-2.16-1.09-2.16-2.42s.96-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.33-.95 2.42-2.16 2.42z"/></svg>',
	google: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.81z"/><path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.28a12 12 0 0 0 0 10.76l4.01-3.1z"/><path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.59 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.28 6.62l4.01 3.1C6.23 6.88 8.88 4.77 12 4.77z"/></svg>',
};

// ── Rendering ─────────────────────────────────────────────────────────

const inputId = (field: BdSignInField) => `${ID}-${field}`;
const errorId = (field: BdSignInField) => `${ID}-${field}-error`;

function errorSlot(field: BdSignInField, message: string | null | undefined, oob = false): Raw {
	return html`<p class="bd-sign-in__error" id="${errorId(field)}" aria-live="polite"${raw(oob ? ' hx-swap-oob="true"' : "")}${raw(message ? "" : " hidden")}>${message ?? ""}</p>`;
}

function problemSlot(text: string | null, oob = false): Raw {
	return html`<p class="bd-sign-in__problem" id="${ID}-problem" role="alert"${raw(oob ? ' hx-swap-oob="true"' : "")}${raw(text ? "" : " hidden")}>${text ?? ""}</p>`;
}

function noticeSlot(text: string | null, oob = false): Raw {
	return html`<p class="bd-sign-in__notice" id="${ID}-notice" role="status"${raw(oob ? ' hx-swap-oob="true"' : "")}${raw(text ? "" : " hidden")}>${text ?? ""}</p>`;
}

function input(field: BdSignInField, view: View): Raw {
	const spec = SPEC[field];
	const error = view.errors[field];
	const autoSubmitCode = field === "code" && view.pending?.purpose !== "reset";
	const autocomplete = field === "password" && view.step === "createAccount" ? "new-password" : spec.autocomplete;
	// Passwords are never written back into the page.
	const value = field === "password" || field === "newPassword" ? "" : (view.values[field] ?? "");
	// Leaving a box checks it; a box marked wrong is checked again as it's typed in.
	const check = autoSubmitCode
		? raw(
				// Six digits sends the code — the whole form, as the button would.
				// (htmx can't parse a regular expression inside a trigger filter.)
				`hx-post="${POST_PATH}" hx-trigger="input[this.value.length===6&amp;&amp;!isNaN(this.value)] changed" hx-target="#${ID}" hx-swap="outerHTML" hx-indicator="#${ID}"`,
			)
		: raw(
				`hx-post="${CHECK_PATH}" hx-params="step,state,${field}" hx-trigger="change, input[!document.getElementById('${errorId(field)}').hidden] changed delay:300ms" hx-target="#${errorId(field)}" hx-swap="outerHTML" hx-indicator="#${errorId(field)}"`,
			);
	return html`<div class="bd-sign-in__field${error ? " bd-sign-in__field--error" : ""}">
		<input class="bd-sign-in__input${field === "code" ? " bd-sign-in__input--code" : ""}" id="${inputId(field)}" name="${field}"
			type="${spec.type}" autocomplete="${autocomplete}"${raw(spec.inputmode ? ` inputmode="${spec.inputmode}"` : "")}${raw(field === "code" ? ' maxlength="6"' : "")}
			placeholder="${spec.label}" aria-label="${spec.label}" aria-describedby="${errorId(field)}" value="${value}"${raw(error ? ' aria-invalid="true"' : "")}${raw(view.focus === field ? " autofocus" : "")}
			${check} />
		${errorSlot(field, error)}
	</div>`;
}

function fieldRows(view: View): Raw[] {
	const names = fieldsFor(view);
	const out: Raw[] = [];
	for (let i = 0; i < names.length; i++) {
		const field = names[i] as BdSignInField;
		if (field === "firstName" && names[i + 1] === "lastName") {
			out.push(html`<div class="bd-sign-in__row">${input("firstName", view)}${input("lastName", view)}</div>`);
			i++;
			continue;
		}
		out.push(input(field, view));
	}
	return out;
}

function texts(view: View) {
	const name = (view.options.name ?? "").trim() || null;
	switch (view.step) {
		case "signIn":
			return {
				title: name ? fill(S.signInTitle, { name }) : S.signInTitleNoName,
				subtitle: "Sign in to see your jobs and invoices.",
				primary: S.signIn,
				hint: null,
				links: view.options.password
					? [
							{ go: "forgot", label: S.forgotPassword },
							{ go: "createAccount", label: S.noAccount },
						]
					: [],
			};
		case "createAccount":
			return {
				title: name ? fill(S.createTitle, { name }) : S.createTitleNoName,
				subtitle: name ? fill(S.createSubtitle, { name }) : S.createSubtitleNoName,
				primary: S.createAccount,
				hint: S.passwordRule,
				links: [{ go: "signIn", label: S.haveAccount }],
			};
		case "forgot":
			return {
				title: S.forgotTitle,
				subtitle: S.forgotSubtitle,
				primary: S.sendCode,
				hint: null,
				links: [{ go: "signIn", label: S.backToSignIn }],
			};
		case "code": {
			const reset = view.pending?.purpose === "reset";
			return {
				title: S.codeTitle,
				subtitle: fill(reset ? S.codeResetSubtitle : S.codeSubtitle, { email: view.pending?.email ?? "" }),
				primary: S.confirm,
				hint: reset ? S.passwordRule : null,
				links: [
					{ go: "resend", label: S.resendCode },
					{ go: "signIn", label: S.backToSignIn },
				],
			};
		}
	}
}

/** The brand colours as the SDK's screen sets them: primary on the button, secondary on links. */
function colorStyle(options: BdSignInOptions): string {
	const palette = signInPalette(options.primaryColor, options.secondaryColor);
	if (!palette) return "";
	return [
		`--bd-sign-in-accent:${palette.accent}`,
		`--bd-sign-in-on-accent:${palette.onAccent}`,
		`--bd-sign-in-link:${palette.link}`,
		`--bd-sign-in-link-dark:${palette.linkDark}`,
		`--bd-sign-in-ring-light:${palette.ring}`,
		`--bd-sign-in-ring-dark:${palette.ringDark}`,
	].join(";");
}

function providers(view: View): Raw {
	if (view.step !== "signIn" && view.step !== "createAccount") return raw("");
	const offered = new Set(view.options.oauth ?? []);
	const list = BD_OAUTH_PROVIDERS.filter((id) => offered.has(id));
	if (list.length === 0) return raw("");
	const returnTo = encodeURIComponent(accountPath(view.next));
	return html`<div class="bd-sign-in__providers">
		<div class="bd-sign-in__divider">${S.or}</div>
		${list.map(
			(id) => html`<a class="bd-sign-in__provider bd-sign-in__provider--${id}" href="/api/bd-auth/customer/oauth/${id}?returnTo=${raw(returnTo)}">${raw(PROVIDER_MARK[id])}<span>${PROVIDER_LABEL[id]}</span></a>`,
		)}
	</div>`;
}

/** The whole screen: the element HTMX swaps on each step. */
export function renderSignIn(view: View): Raw {
	const t = texts(view);
	const logo = typeof view.options.logoUrl === "string" && view.options.logoUrl.startsWith("https://") ? view.options.logoUrl : null;
	return html`<div class="bd-sign-in" id="${ID}" style="${colorStyle(view.options)}">
		<form class="bd-sign-in__form" method="post" action="${POST_PATH}" novalidate
			hx-post="${POST_PATH}" hx-target="#${ID}" hx-swap="outerHTML" hx-indicator="#${ID}" hx-disabled-elt="find .bd-sign-in__primary">
			<input type="hidden" name="step" value="${view.step}" />
			${view.sealed ? html`<input type="hidden" name="state" value="${view.sealed}" />` : ""}
			${view.next ? html`<input type="hidden" name="next" value="${view.next}" />` : ""}
			<fieldset class="bd-sign-in__fieldset">
				<div class="bd-sign-in__header">
					${logo ? html`<img class="bd-sign-in__logo" src="${logo}" alt="" onerror="this.hidden=true" />` : ""}
					<h2 class="bd-sign-in__title">${t.title}</h2>
					${t.subtitle ? html`<p class="bd-sign-in__subtitle">${t.subtitle}</p>` : ""}
				</div>
				<div class="bd-sign-in__body">
					<div class="bd-sign-in__body">
						${fieldRows(view)}
						${t.hint ? html`<p class="bd-sign-in__hint">${t.hint}</p>` : ""}
					</div>
					${problemSlot(view.problem)}
					${noticeSlot(view.notice)}
					<button type="submit" class="bd-sign-in__primary"><span class="bd-sign-in__label">${t.primary}</span><span class="bd-sign-in__spinner" aria-hidden="true"></span></button>
				</div>
				${t.links.length
					? html`<div class="bd-sign-in__links">${t.links.map(
							(link) => html`<button type="submit" name="go" value="${link.go}" class="bd-sign-in__link">${link.label}</button>`,
						)}</div>`
					: ""}
				${providers(view)}
			</fieldset>
		</form>
	</div>`;
}

/** The SDK screen's stylesheet, plus what the server-rendered screen adds. */
export function signInCss(): Response {
	const extra = `
.bd-sign-in.htmx-request .bd-sign-in__primary .bd-sign-in__spinner{display:block;position:absolute}
.bd-sign-in.htmx-request .bd-sign-in__primary .bd-sign-in__label{visibility:hidden}
.bd-sign-in__field:has(>.bd-sign-in__error:not([hidden])) .bd-sign-in__input{border-color:var(--bd-sign-in-danger);box-shadow:0 0 0 3px color-mix(in srgb,var(--bd-sign-in-danger) 14%,transparent)}
/* This site's pages are light only (public/styles.css), so the screen stays light too. */
@media (prefers-color-scheme:dark){.bd-sign-in{--bd-sign-in-accent:#111827;--bd-sign-in-on-accent:#fff;--bd-sign-in-link-color:var(--bd-sign-in-link,var(--bd-sign-in-accent));--bd-sign-in-ring:var(--bd-sign-in-ring-light,var(--bd-sign-in-accent));--bd-sign-in-text:#111827;--bd-sign-in-muted:#6b7280;--bd-sign-in-field:rgba(118,118,128,.12);--bd-sign-in-line:rgba(60,60,67,.18);--bd-sign-in-danger:#dc2626}.bd-sign-in__provider--apple{background:#000;color:#fff}}
`;
	return new Response(BD_SIGN_IN_CSS + extra, {
		headers: { "Content-Type": "text/css; charset=utf-8", "Cache-Control": "public, max-age=300" },
	});
}

/** For /my-account when nobody's signed in: the screen, its styles and the focus helper. */
export async function signInSection(origin: string, url: URL): Promise<Raw> {
	const failed = url.searchParams.get("bd_oauth_error");
	const view: View = {
		step: url.searchParams.get("start") === "create" ? "createAccount" : "signIn",
		pending: null,
		sealed: null,
		values: {},
		errors: {},
		// Back from a provider that didn't finish.
		problem: failed ? url.searchParams.get("bd_oauth_message") || "Sign-in didn't finish. Try again." : null,
		notice: null,
		focus: null,
		options: await loadOptions(origin),
		next: safeNext(url.searchParams.get("next")),
	};
	return section(view);
}

function section(view: View): Raw {
	return html`<link rel="stylesheet" href="/bd-sign-in.css" />
		<div class="signin-card">${renderSignIn(view)}</div>
		<script>document.body.addEventListener("bd-sign-in-focus",function(e){var el=document.getElementById("${ID}-"+e.detail.value);if(el)el.focus();});</script>`;
}

// ── Requests ──────────────────────────────────────────────────────────

function readValues(form: FormData): Partial<Record<BdSignInField, string>> {
	const values: Partial<Record<BdSignInField, string>> = {};
	for (const field of FIELDS) {
		const value = form.get(field);
		if (typeof value === "string") values[field] = field === "code" ? value.replace(/\D/g, "").slice(0, 6) : value;
	}
	return values;
}

const clean = (text: string | undefined) => (text ?? "").trim() || null;

/** POST /my-account/sign-in/check — one box, as the person leaves it. */
export async function handleSignInCheck(req: Request): Promise<Response> {
	const form = await req.formData();
	const field = req.headers.get("HX-Trigger-Name") as BdSignInField | null;
	const step = STEPS.includes(form.get("step") as Step) ? (form.get("step") as Step) : "signIn";
	if (!field || !FIELDS.includes(field)) return new Response("", { status: 400 });
	const value = readValues(form)[field] ?? "";
	const message = validateSignInField(field, value, step, S);
	return new Response(render(errorSlot(field, message)), { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

/**
 * POST /my-account/sign-in — the button, a link ("Forgot password?", "Send a
 * new code", …) or six digits in the code box. Renders the next step, signs
 * in (cookie + redirect), or says what's wrong without clearing what was typed.
 */
export async function handleSignInPost(
	req: Request,
	url: URL,
	fullPage: (section: Raw) => Promise<string>,
): Promise<Response> {
	const htmx = req.headers.get("HX-Request") === "true";
	const form = await req.formData();
	const go = typeof form.get("go") === "string" ? (form.get("go") as string) : null;
	const postedStep = STEPS.includes(form.get("step") as Step) ? (form.get("step") as Step) : "signIn";
	const values = readValues(form);
	const pending = postedStep === "code" ? await unseal(form.get("state") as string | null) : null;
	const view: View = {
		step: postedStep,
		pending,
		sealed: pending ? ((form.get("state") as string) ?? null) : null,
		values,
		errors: {},
		problem: null,
		notice: null,
		focus: null,
		options: await loadOptions(url.origin),
		next: safeNext(form.get("next")),
	};

	const html200 = (body: string, headers: Record<string, string> = {}) =>
		new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...headers } });

	/** A new step (or the same one, fresh): the whole screen. */
	const show = async (next: View) =>
		htmx
			? html200(
					render(renderSignIn(next)),
					// `autofocus` alone isn't honoured in swapped content.
					next.focus ? { "HX-Trigger-After-Settle": JSON.stringify({ "bd-sign-in-focus": next.focus }) } : {},
				)
			: html200(await fullPage(section(next)));

	/** What's wrong, under the boxes — HTMX leaves the typed values where they are. */
	const refuse = async () => {
		if (!htmx) return show(view);
		const parts = fieldsFor(view).map((f) => render(errorSlot(f, view.errors[f], true)));
		parts.push(render(problemSlot(view.problem, true)), render(noticeSlot(null, true)));
		const first = fieldsFor(view).find((f) => view.errors[f]);
		return html200(parts.join(""), {
			"HX-Reswap": "none",
			...(first ? { "HX-Trigger": JSON.stringify({ "bd-sign-in-focus": first }) } : {}),
		});
	};

	const signedIn = (cookie: string | null) => {
		const headers = new Headers({ "Cache-Control": "no-store" });
		if (cookie) headers.append("Set-Cookie", cookie);
		if (htmx) {
			headers.set("HX-Redirect", view.next ?? SIGN_IN_PATH);
			return new Response(null, { status: 200, headers });
		}
		headers.set("Location", view.next ?? SIGN_IN_PATH);
		return new Response(null, { status: 303, headers });
	};

	const toCode = async (sent: Record<string, unknown>, details: Omit<Pending, "pendingId" | "exp">, notice: string | null = null) => {
		const next = pendingFrom(sent, details);
		if (!next) {
			view.problem = UNAVAILABLE.message;
			return refuse();
		}
		return show({ ...view, step: "code", pending: next, sealed: await seal(next), errors: {}, problem: null, notice, focus: "code", values: { ...values, code: "", newPassword: "" } });
	};

	const failed = (answer: Extract<Answer, { ok: false }>) => {
		const field = fieldFor(answer.code, fieldsFor(view));
		if (field) view.errors[field] = answer.message;
		else view.problem = answer.message;
		return refuse();
	};

	// The code step's details didn't survive (expired, or from another server).
	if (postedStep === "code" && !pending) {
		return show({ ...view, step: "signIn", pending: null, sealed: null, errors: {}, problem: "That code has expired. Start again.", focus: "email" });
	}

	// A link: another step, or a new code.
	if (go === "forgot" || go === "createAccount" || go === "signIn") {
		return show({
			...view,
			step: go,
			pending: null,
			sealed: null,
			errors: {},
			values: { email: values.email ?? pending?.email ?? "", firstName: values.firstName ?? "", lastName: values.lastName ?? "" },
			focus: go === "createAccount" ? "firstName" : "email",
		});
	}
	if (go === "resend" && pending) {
		const details = { purpose: pending.purpose, email: pending.email, password: pending.password, firstName: pending.firstName, lastName: pending.lastName };
		let answer: Answer;
		if (pending.purpose === "signUp") {
			answer = await customer(url.origin, "sign-up", { email: pending.email, password: pending.password ?? "", firstName: pending.firstName, lastName: pending.lastName });
		} else if (pending.purpose === "verify") {
			answer = await customer(url.origin, "sign-in", { email: pending.email, password: pending.password ?? "" });
			if (answer.ok && typeof answer.body.pendingId !== "string") return signedIn(answer.cookie);
		} else {
			answer = await customer(url.origin, "forgot-password", { email: pending.email });
		}
		if (!answer.ok) {
			view.problem = answer.message;
			return refuse();
		}
		return toCode(answer.body, details, S.codeResent);
	}

	// The button: every box first, then BD.
	for (const field of fieldsFor(view)) {
		const message = validateSignInField(field, values[field] ?? "", view.step, S);
		if (message) view.errors[field] = message;
	}
	if (Object.keys(view.errors).length > 0) return refuse();

	const email = (values.email ?? "").trim();
	switch (view.step) {
		case "signIn": {
			const answer = await customer(url.origin, "sign-in", { email, password: values.password ?? "" });
			if (!answer.ok) return failed(answer);
			// WorkOS wants the email confirmed first; it has sent a code.
			if (typeof answer.body.pendingId === "string") {
				return toCode(answer.body, { purpose: "verify", email, password: values.password ?? "", firstName: null, lastName: null });
			}
			return signedIn(answer.cookie);
		}
		case "createAccount": {
			const details = { purpose: "signUp" as const, email, password: values.password ?? "", firstName: clean(values.firstName), lastName: clean(values.lastName) };
			const answer = await customer(url.origin, "sign-up", { email, password: details.password, firstName: details.firstName, lastName: details.lastName });
			if (!answer.ok) return failed(answer);
			return toCode(answer.body, details);
		}
		case "forgot": {
			const answer = await customer(url.origin, "forgot-password", { email });
			if (!answer.ok) return failed(answer);
			return toCode(answer.body, { purpose: "reset", email, password: null, firstName: null, lastName: null });
		}
		case "code": {
			const p = pending as Pending;
			const answer = await customer(url.origin, "verify", {
				pendingId: p.pendingId,
				code: values.code ?? "",
				newPassword: p.purpose === "reset" ? (values.newPassword ?? "") : null,
			});
			if (!answer.ok) return failed(answer);
			return signedIn(answer.cookie);
		}
	}
}
