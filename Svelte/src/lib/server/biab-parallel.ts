import { env } from "$env/dynamic/private";

import {
	BiabPaymentLapsedError,
	BiabServiceSuspendedError,
} from "@businessdash/sdk";
import type {
	ParallelPagesRenderResponse,
	ParallelPagesVariantsResponse,
} from "@businessdash/sdk";

import { biab } from "$lib/server/biab";

/**
 * Parallel-pages (programmatic SEO) + SEO-proxy helpers.
 *
 * The high-level `client.parallelPages` is already bound to this site's
 * id, so we call `.listVariants(key)` / `.render(key, slugs)` directly.
 * `.sitemapUrl()` / `.robotsUrl()` return RELATIVE API paths
 * (`sites/<id>/sitemap.xml`); we resolve them against the normalised base
 * URL here so the `/sitemap.xml` + `/robots.txt` routes can proxy them.
 */

export const PARALLEL_KEY = "service-area";

function normalizeBaseUrl(input: string): string {
	const next = input.trim().replace(/\/+$/, "");
	if (next.endsWith("/api/package/v1")) return next;
	return `${next}/api/package/v1`;
}

/** API key + resolved base URL, or null when unconfigured. */
export function seoProxyConfig(): { apiKey: string; baseUrl: string } | null {
	const apiKey = env.BIAB_API_KEY;
	const rawBaseUrl = env.BIAB_PACKAGE_API_BASE_URL;
	if (!apiKey || !rawBaseUrl) return null;
	return { apiKey, baseUrl: normalizeBaseUrl(rawBaseUrl) };
}

/** Absolute URL for the BIAB-hosted sitemap.xml (null when unconfigured). */
export function sitemapProxyUrl(): string | null {
	if (!biab) return null;
	const cfg = seoProxyConfig();
	if (!cfg) return null;
	return `${cfg.baseUrl}/${biab.parallelPages.sitemapUrl()}`;
}

/** Absolute URL for the BIAB-hosted robots.txt (null when unconfigured). */
export function robotsProxyUrl(): string | null {
	if (!biab) return null;
	const cfg = seoProxyConfig();
	if (!cfg) return null;
	return `${cfg.baseUrl}/${biab.parallelPages.robotsUrl()}`;
}

/** Every (service × area) variant declared in `biab.config.ts`, for the index. */
export async function listServiceAreaVariants(): Promise<
	ParallelPagesVariantsResponse["variants"]
> {
	if (!biab) return [];
	try {
		const { variants } = await biab.parallelPages.listVariants(PARALLEL_KEY);
		return variants;
	} catch (err) {
		if (env.NODE_ENV === "development") {
			console.warn(
				`[biab] parallelPages.listVariants failed: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
		return [];
	}
}

export type RenderResult =
	| { status: "ok"; variant: ParallelPagesRenderResponse | null }
	| { status: "unavailable"; reason: "lapsed" | "suspended" };

/** Render one (service × area) page, translating suspension errors. */
export async function renderServiceArea(
	service: string,
	area: string,
): Promise<RenderResult> {
	if (!biab) return { status: "ok", variant: null };
	try {
		const variant = await biab.parallelPages.render(PARALLEL_KEY, {
			service,
			area,
		});
		return { status: "ok", variant };
	} catch (err) {
		if (err instanceof BiabServiceSuspendedError) {
			return { status: "unavailable", reason: "suspended" };
		}
		if (err instanceof BiabPaymentLapsedError) {
			return { status: "unavailable", reason: "lapsed" };
		}
		if (env.NODE_ENV === "development") {
			console.warn(
				`[biab] parallelPages.render failed: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
		return { status: "ok", variant: null };
	}
}
