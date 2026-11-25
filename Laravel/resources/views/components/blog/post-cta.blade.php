{{-- The post's call to action, when it has one. Only web, mail, same-site and in-page links; anything else goes nowhere. --}}
@props(['post'])
@php
    $href = trim((string) data_get($post, 'ctaHref', ''));
    $href = preg_match('/^(https?:|mailto:|\/|#)/i', $href) === 1 ? $href : '#';
@endphp
@if (data_get($post, 'ctaHref') && data_get($post, 'ctaLabel'))
    <aside class="bd-card post__cta">
        @if (data_get($post, 'ctaDescription'))<p>{{ data_get($post, 'ctaDescription') }}</p>@endif
        <a class="bd-btn" href="{{ $href }}">{{ data_get($post, 'ctaLabel') }}</a>
    </aside>
@endif
