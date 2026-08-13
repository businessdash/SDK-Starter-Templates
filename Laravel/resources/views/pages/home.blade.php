@extends('layout')

@section('title', data_get($bundle, 'sections.hero.headline', config('app.name')))

@section('content')
    {{--
        Every section reads the marketing bundle and falls back to local copy.
        `data_get` with a default is doing the work an `??` chain would do in
        the JS starters — the bundle is absent entirely when BIAB isn't
        configured, and partially absent when a section hasn't been authored.
    --}}
    <section class="hero">
        <h1>{{ data_get($bundle, 'sections.hero.headline', 'A business, in a box.') }}</h1>
        <p>{{ data_get($bundle, 'sections.hero.subhead', 'Everything the operation needs, on your own domain.') }}</p>
        @if ($cta = data_get($bundle, 'sections.hero.ctaLabel'))
            <a class="button" href="{{ data_get($bundle, 'sections.hero.ctaHref', route('store')) }}">{{ $cta }}</a>
        @else
            <a class="button" href="{{ route('store') }}">Browse the store</a>
        @endif
    </section>

    <section class="about">
        <h2>{{ data_get($bundle, 'sections.about.title', 'About us') }}</h2>
        <p>{{ data_get($bundle, 'sections.about.body', 'Tell your story here — this copy lives in the BIAB dashboard once you are connected.') }}</p>
    </section>

    @if ($products)
        <section class="services">
            <h2>{{ data_get($bundle, 'sections.services.title', 'What we offer') }}</h2>
            <ul class="grid">
                @foreach ($products as $product)
                    <li class="card">
                        <a href="{{ route('store.product', data_get($product, 'id')) }}">
                            <h3>{{ data_get($product, 'name') }}</h3>
                            <p class="muted">{{ data_get($product, 'description') }}</p>
                        </a>
                    </li>
                @endforeach
            </ul>
        </section>
    @endif

    @if ($posts)
        <section class="blog-teaser">
            <h2>From the blog</h2>
            <ul>
                @foreach ($posts as $post)
                    <li>
                        <a href="{{ route('blog.show', data_get($post, 'slug')) }}">
                            {{ data_get($post, 'title') }}
                        </a>
                    </li>
                @endforeach
            </ul>
        </section>
    @endif

    <section class="contact">
        <h2>Get in touch</h2>
        {{--
            The <biab-form> web component, pointed at this app's own proxy.
            It renders the whole `general-inquiry` schema — flex rows, the
            conditional preferred-method block, the availability picker —
            which a hand-written Blade fragment can't reproduce. The bearer
            key stays server-side because the component only ever talks to
            /api/biab/forms/*.
        --}}
        <biab-form slug="general-inquiry" submit-label="Send"></biab-form>
    </section>
@endsection

@push('head')
    <link rel="stylesheet" href="https://esm.sh/@businessdash/sdk@0.9.60/biab-forms.css">
@endpush

@push('scripts')
    <script type="module">
        import { setBiabFormClient } from "https://esm.sh/@businessdash/sdk@0.9.60/element";

        // The element can't take a client through an HTML attribute, so set
        // a DI default once. `baseUrl` is this app's proxy, not BIAB — the
        // proxy injects the real key server-side.
        setBiabFormClient({
            baseUrl: "/api/biab/forms",
            apiKey: "browser-proxy",
        });
    </script>
@endpush
