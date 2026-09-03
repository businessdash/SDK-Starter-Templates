import { Injectable, PLATFORM_ID, inject } from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import { createBdClient } from "@businessdash/sdk";
import type { BdClient } from "@businessdash/sdk";

import { environment } from "../../environments/environment";

/**
 * Browser-side followers / newsletter-subscribe service.
 *
 * Unlike the rest of this starter (which proxies BD through the SSR server so
 * the powerful API key never reaches the browser), followers run on a
 * BROWSER-SAFE publishable token (`pk_…`, origin-locked, rate-limited, scoped to
 * `followers:self`). That token is shippable, so we create the core
 * `createBdClient(...)` directly in the browser — no backend needed.
 *
 * This mirrors what `@businessdash/sdk/react`'s `useFollowers` hook does internally:
 *   - `join`/`leave`/`me`/`edit` go through `client.followers.*`, and
 *   - an anonymous "already subscribed?" hint is persisted per-browser in
 *     `localStorage` under `bd.followers.<siteId>` so a visitor who already
 *     subscribed isn't shown the form forever.
 *
 * Source of truth for "is this visitor subscribed":
 *   - logged-in  → `me(email)` (authoritative, cross-device), and
 *   - anonymous  → `subscribedLocally` (the per-browser flag). IP is NOT used.
 */

type LocalFollow = { email: string; at: number };

const FOLLOWER_STORE_PREFIX = "bd.followers.";

/** True when the browser-safe publishable credentials are present. */
export const BD_FOLLOWERS_ENABLED = Boolean(
	environment.bdPk && environment.bdSiteId,
);

@Injectable({ providedIn: "root" })
export class FollowersService {
	private readonly platformId = inject(PLATFORM_ID);
	private readonly isBrowser = isPlatformBrowser(this.platformId);

	/** Lazily-built core client (browser-only — `createBdClient` needs fetch
	 *  and the publishable token, neither of which we run during SSR). */
	private client: BdClient | null = null;

	private readonly storeKey = `${FOLLOWER_STORE_PREFIX}${environment.bdSiteId}`;

	/** Whether followers are wired up (publishable token + site id present). */
	get enabled(): boolean {
		return BD_FOLLOWERS_ENABLED;
	}

	private getClient(): BdClient | null {
		if (!this.isBrowser || !this.enabled) return null;
		if (!this.client) {
			this.client = createBdClient({
				apiKey: environment.bdPk,
				siteId: environment.bdSiteId,
				...(environment.bdBaseUrl ? { baseUrl: environment.bdBaseUrl } : {}),
			});
		}
		return this.client;
	}

	// ── Per-browser "already subscribed" hint (localStorage) ──────────────

	private readLocal(): LocalFollow | null {
		if (!this.isBrowser) return null;
		try {
			const raw = window.localStorage.getItem(this.storeKey);
			if (!raw) return null;
			const parsed = JSON.parse(raw) as Partial<LocalFollow>;
			return typeof parsed?.email === "string"
				? { email: parsed.email, at: Number(parsed.at) || 0 }
				: null;
		} catch {
			return null;
		}
	}

	private writeLocal(value: LocalFollow): void {
		if (!this.isBrowser) return;
		try {
			window.localStorage.setItem(this.storeKey, JSON.stringify(value));
		} catch {
			// storage disabled / quota — the local hint is best-effort.
		}
	}

	private clearLocal(): void {
		if (!this.isBrowser) return;
		try {
			window.localStorage.removeItem(this.storeKey);
		} catch {
			// ignore
		}
	}

	/** This browser already subscribed (instant, no network). Use to hide a
	 *  newsletter form for anonymous visitors. */
	get subscribedLocally(): boolean {
		return this.readLocal() !== null;
	}

	/** Email this browser subscribed with, or `null` if it hasn't. */
	get localEmail(): string | null {
		return this.readLocal()?.email ?? null;
	}

	// ── Actions (all `followers:self`; a publishable token can run them) ───

	/** Subscribe an email (and remember this browser). Idempotent server-side. */
	async join(input: { email: string; name?: string; source?: string }) {
		const client = this.getClient();
		if (!client) return null;
		const res = await client.followers.join(input);
		this.writeLocal({ email: input.email, at: Date.now() });
		return res;
	}

	/** Unsubscribe an email (and forget this browser). */
	async leave(email: string) {
		const client = this.getClient();
		if (!client) return null;
		const res = await client.followers.leave({ email });
		this.clearLocal();
		return res;
	}

	/** Authoritative status for a known (logged-in) email — cross-device. */
	async me(email: string) {
		const client = this.getClient();
		if (!client) return null;
		return client.followers.me({ email });
	}

	/** Patch a follower's name / source. */
	async edit(email: string, patch: { name?: string; source?: string }) {
		const client = this.getClient();
		if (!client) return null;
		return client.followers.edit({ email, patch });
	}
}
