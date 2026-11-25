{{--
    One post. Its HTML was rebuilt from an allowlist (App\Support\PostHtml),
    so the raw HTML never reaches the page. The like button and comments are
    <bd-post-like> and <bd-post-comments> (public/shop/blog-elements.js);
    signed out, they lead to sign-in and back to the post.
--}}
@extends('layout')
@section('title', $post ? data_get($post, 'title').' — Blog' : 'Post not found')
@push('head')
    <link rel="stylesheet" href="/bd-pages.css">
    <link rel="stylesheet" href="/bd-blog.css">
@endpush
@if ($post)
    @push('scripts')
        <script type="module" src="/shop/blog-elements.js"></script>
    @endpush
@endif
@section('main_class', 'bd-page')
@section('content')
    @if (! $configured)
        <div class="bd-empty">The blog isn't connected yet. Add your BD env, then publish a post in Business Dash.</div>
    @elseif (! $post)
        <div class="bd-empty">That post isn't available. <a href="{{ route('blog') }}">See all posts</a></div>
    @else
        @php
            $slug = data_get($post, 'slug');
            $ctaHref = (string) data_get($post, 'ctaHref', '');
            // Only web, mail, same-site and in-page links; anything else goes nowhere.
            $ctaHref = preg_match('/^(https?:|mailto:|\/|#)/i', trim($ctaHref)) === 1 ? trim($ctaHref) : '#';
        @endphp
        <article class="post">
            <a class="post__back" href="{{ route('blog') }}">← All posts</a>
            <header class="post__head">
                <h1>{{ data_get($post, 'title') }}</h1>
                <p class="post__meta">
                    @if (data_get($post, 'authorAvatarUrl'))
                        <img alt="" referrerpolicy="no-referrer" src="{{ data_get($post, 'authorAvatarUrl') }}">
                    @endif
                    @if (data_get($post, 'authorName'))<span>{{ data_get($post, 'authorName') }}</span>@endif
                    <span>{{ \App\Support\PostHtml::date(data_get($post, 'publishedAt')) }}</span>
                    <span>· {{ $minutes }} min read</span>
                </p>
            </header>
            @if (data_get($post, 'imageUrl'))
                <img alt="" class="post__cover" referrerpolicy="no-referrer" src="{{ data_get($post, 'imageUrl') }}">
            @endif
            @if ($paywalled)
                <div class="bd-empty">This post is for members.<p><a class="bd-btn" href="{{ $signInHref }}">Sign in to read it</a></p></div>
            @else
                {{-- Safe: PostHtml::safe rebuilt this from an allowlist. --}}
                <div class="post__body">{!! $html !!}</div>
            @endif
            @if (data_get($post, 'ctaHref') && data_get($post, 'ctaLabel'))
                <aside class="bd-card post__cta">
                    @if (data_get($post, 'ctaDescription'))<p>{{ data_get($post, 'ctaDescription') }}</p>@endif
                    <a class="bd-btn" href="{{ $ctaHref }}">{{ data_get($post, 'ctaLabel') }}</a>
                </aside>
            @endif
            @if (data_get($post, 'tags'))
                <ul class="post__tags">
                    @foreach (data_get($post, 'tags') as $tag)
                        <li><a href="{{ route('blog').'?tag='.rawurlencode($tag) }}">#{{ $tag }}</a></li>
                    @endforeach
                </ul>
            @endif
            <bd-post-like data-like-url="{{ route('blog.like', $slug, false) }}" data-sign-in-href="{{ $signInHref }}">
                <x-element-data :value="$likes" />
            </bd-post-like>
        </article>
        <bd-post-comments data-comment-url="{{ route('blog.comment', $slug, false) }}" data-sign-in-href="{{ $signInHref }}">
            <x-element-data :value="$comments" />
        </bd-post-comments>
    @endif
@endsection
