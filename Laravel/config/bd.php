<?php

/**
 * BD Web Content SDK — configuration.
 *
 * Easiest path to real values: the guided wizard in your BD dashboard —
 * Settings → Web Content SDK.
 *
 * Everything here is server-side. Laravel never ships `.env` to the browser,
 * so unlike the Vite/Next starters there is no PUBLIC_/NEXT_PUBLIC_ split to
 * think about: the browser only receives what a Blade template prints.
 */
return [
    /*
     * Where BD is hosted. The host root — the client appends
     * `/api/package/v1` itself, and the SEO/AEO routes need the bare root.
     */
    'host' => rtrim(env('BD_HOST', 'https://www.biab.app'), '/'),

    /* The site UUID this app renders. Site Builder ▸ Developer ▸ "Site ID". */
    'site_id' => env('BD_SITE_ID'),

    /*
     * Secret API key (`sk_…`) for authenticated server-side reads.
     * NEVER print this into a Blade template.
     */
    'api_key' => env('BD_API_KEY'),

    /*
     * Publishable token (`pk_…`): origin-locked, rate-limited, browser-safe.
     * Only needed if you add a browser island that talks to BD directly.
     * The bundled <bd-form> island goes through this app's own proxy route
     * instead, so it stays optional.
     */
    'publishable_key' => env('BD_PK'),

    /* HMAC secret (`whsec_…`) for the BD → this-app revalidate webhook. */
    'revalidation_secret' => env('BD_REVALIDATION_SECRET'),

    /*
     * Public, fully-qualified URL of this app's auth callback. Register it as
     * a redirect URI in your BD site's auth settings.
     */
    'auth_callback_url' => env('BD_AUTH_CALLBACK_URL'),

    /*
     * Origin sent on every server-to-server call. The platform gates
     * publishable tokens and some routes on the requesting host, so this has
     * to be the site's real public origin. Defaults to APP_URL.
     */
    'site_origin' => rtrim(env('BD_SITE_ORIGIN', env('APP_URL', 'http://localhost:8000')), '/'),

    /* Seconds to cache marketing/catalog reads. The revalidate webhook busts
     * these by tag the moment content is published, so this is just a floor. */
    'cache_ttl' => (int) env('BD_CACHE_TTL', 300),

    /* Cookie names. The session cookie is written by the auth callback and
     * read by SSR on every request; the cart cookie pins an anonymous cart. */
    'session_cookie' => 'bd_session',
    'cart_cookie' => 'bd_cart_visitor',
];
