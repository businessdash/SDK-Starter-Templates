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
    'host' => rtrim(env('BD_HOST', 'https://businessdash.us'), '/'),

    /* The site UUID this app renders. Site Builder ▸ Developer ▸ "Site ID". */
    'site_id' => env('BD_SITE_ID'),

    /*
     * Secret API key (`sk_…`) for authenticated server-side reads.
     * NEVER print this into a Blade template.
     */
    'api_key' => env('BD_API_KEY'),

    /*
     * Publishable token (`pk_…`): origin-locked, rate-limited, browser-safe.
     * Only needed if you add a browser island that talks to BD directly
     * (the analytics island uses it). Forms and quizzes are drawn on this
     * server with the secret key, so they don't.
     */
    'publishable_key' => env('BD_PK'),

    /* HMAC secret (`whsec_…`) for the BD → this-app revalidate webhook. */
    'revalidation_secret' => env('BD_REVALIDATION_SECRET'),

    /*
     * Optional, only for the older hosted sign-in page: the public URL of
     * this app's /api/bd-auth/callback, registered as a redirect URI in your
     * BD site's auth settings. The sign-in screen on /my-account doesn't use it.
     */
    'auth_callback_url' => env('BD_AUTH_CALLBACK_URL'),

    /*
     * Origin sent on every server-to-server call. The platform gates
     * publishable tokens and some routes on the requesting host, so this has
     * to be the site's real public origin. Defaults to APP_URL.
     */
    'site_origin' => rtrim(env('BD_SITE_ORIGIN', env('APP_URL', 'http://localhost:8000')), '/'),

    /*
     * The form the home page's contact section shows, drawn on this server
     * (App\Livewire\BdForm). Until BD is connected it shows the bundled
     * sample instead (/forms/demo).
     */
    'contact_form' => env('BD_CONTACT_FORM', 'general-inquiry'),

    /*
     * The practice quiz /quiz shows. Unset (or before BD is connected) it's
     * the bundled sample (/quiz/sample); invitations open at /quiz-invite/{token}.
     */
    'quiz' => env('BD_QUIZ'),

    /* Seconds to cache marketing/catalog reads. The revalidate webhook busts
     * these by tag the moment content is published, so this is just a floor. */
    'cache_ttl' => (int) env('BD_CACHE_TTL', 300),

    /* Cookie names. The session cookie is written by the auth callback and
     * read by SSR on every request; the cart cookie pins an anonymous cart. */
    'session_cookie' => 'bd_session',
    'cart_cookie' => 'bd_cart_visitor',
];
