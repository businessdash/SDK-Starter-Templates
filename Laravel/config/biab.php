<?php

/**
 * BIAB Web Content SDK — configuration.
 *
 * Easiest path to real values: the guided wizard in your BIAB dashboard —
 * Settings → Web Content SDK.
 *
 * Everything here is server-side. Laravel never ships `.env` to the browser,
 * so unlike the Vite/Next starters there is no PUBLIC_/NEXT_PUBLIC_ split to
 * think about: the browser only receives what a Blade template prints.
 */
return [
    /*
     * Where BIAB is hosted. The host root — the client appends
     * `/api/package/v1` itself, and the SEO/AEO routes need the bare root.
     */
    'host' => rtrim(env('BIAB_HOST', 'https://www.biab.app'), '/'),

    /* The site UUID this app renders. Site Builder ▸ Developer ▸ "Site ID". */
    'site_id' => env('BIAB_SITE_ID'),

    /*
     * Secret API key (`sk_…`) for authenticated server-side reads.
     * NEVER print this into a Blade template.
     */
    'api_key' => env('BIAB_API_KEY'),

    /*
     * Publishable token (`pk_…`): origin-locked, rate-limited, browser-safe.
     * Only needed if you add a browser island that talks to BIAB directly.
     * The bundled <biab-form> island goes through this app's own proxy route
     * instead, so it stays optional.
     */
    'publishable_key' => env('BIAB_PK'),

    /* HMAC secret (`whsec_…`) for the BIAB → this-app revalidate webhook. */
    'revalidation_secret' => env('BIAB_REVALIDATION_SECRET'),

    /*
     * Public, fully-qualified URL of this app's auth callback. Register it as
     * a redirect URI in your BIAB site's auth settings.
     */
    'auth_callback_url' => env('BIAB_AUTH_CALLBACK_URL'),

    /*
     * Origin sent on every server-to-server call. The platform gates
     * publishable tokens and some routes on the requesting host, so this has
     * to be the site's real public origin. Defaults to APP_URL.
     */
    'site_origin' => rtrim(env('BIAB_SITE_ORIGIN', env('APP_URL', 'http://localhost:8000')), '/'),

    /* Seconds to cache marketing/catalog reads. The revalidate webhook busts
     * these by tag the moment content is published, so this is just a floor. */
    'cache_ttl' => (int) env('BIAB_CACHE_TTL', 300),

    /* Cookie names. The session cookie is written by the auth callback and
     * read by SSR on every request; the cart cookie pins an anonymous cart. */
    'session_cookie' => 'biab_session',
    'cart_cookie' => 'biab_cart_visitor',
];
