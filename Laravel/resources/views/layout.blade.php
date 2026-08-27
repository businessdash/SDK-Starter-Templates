{{--
    Page shell. Two BIAB-specific things live here:

    1. The setup banner — shown until BIAB_SITE_ID is set, so a fresh clone
       tells you what to do instead of rendering a mysteriously empty site.
    2. The two browser islands, both loaded from esm.sh as ES modules. That
       is the whole reason this starter needs no bundler and no npm at
       runtime: <biab-form> renders the full form schema client-side, and
       the analytics module records page views.

    The islands are pinned to an exact SDK version on purpose. A CDN import
    has no lockfile, so `@latest` would silently roll this page forward on
    someone else's release. Bump it deliberately, alongside package.json.
--}}
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('title', config('app.name'))</title>
    <link rel="stylesheet" href="/styles.css">
    @stack('head')
</head>
<body>
    @unless (\App\Biab\Biab::configured())
        <div class="banner banner-setup">
            <strong>Not connected to BIAB.</strong>
            Copy <code>.env.example</code> to <code>.env</code> and set
            <code>BIAB_SITE_ID</code> + <code>BIAB_API_KEY</code>.
            Every section below is rendering its local fallback.
            <a href="{{ \App\Biab\Biab::host() }}/login?returnTo=/dashboard/settings/web-content">
                Open the setup wizard →
            </a>
        </div>
    @endunless

    <header class="site-header">
        <a class="brand" href="{{ route('home') }}">{{ config('app.name') }}</a>
        <nav>
            <a href="{{ route('store') }}">Store</a>
            <a href="{{ route('services') }}">Services</a>
            <a href="{{ route('blog') }}">Blog</a>
            <a href="{{ route('reviews') }}">Reviews</a>
            <a href="{{ route('subscriptions') }}">Plans</a>
            <a href="{{ route('todos') }}">Todos</a>
            <a href="{{ route('cart') }}">Cart</a>
            <a href="{{ route('portal') }}">My account</a>
        </nav>
    </header>

    <main>
        @if (session('subscribe_status'))
            <p class="notice">{{ session('subscribe_status') }}</p>
        @endif
        @if (session('cart_error'))
            <p class="notice notice-error">{{ session('cart_error') }}</p>
        @endif

        @yield('content')
    </main>

    <footer class="site-footer">
        <form method="POST" action="{{ route('subscribe') }}" class="subscribe">
            @csrf
            <label for="subscribe-email">Get updates</label>
            <input id="subscribe-email" type="email" name="email" required placeholder="you@example.com">
            <button type="submit">Subscribe</button>
        </form>
        <p class="muted">Powered by BusinessDash</p>
    </footer>

    @if (\App\Biab\Biab::configured())
        <script type="module">
            import { createAnalytics } from "https://esm.sh/@businessdash/sdk@0.9.80/analytics-core";
            createAnalytics({
                siteId: @json(config('biab.site_id')),
                baseUrl: @json(rtrim(config('biab.host'), '/') . '/api/package/v1'),
                apiKey: @json(config('biab.publishable_key')),
            }).trackPageView();
        </script>
    @endif

    @stack('scripts')
</body>
</html>
