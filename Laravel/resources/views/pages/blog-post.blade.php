{{--
    One post. Its HTML was rebuilt from an allowlist (App\Support\PostHtml),
    so the raw HTML never reaches the page. The like button and comments are
    <bd-post-like> and <bd-post-comments> (public/shop/blog-elements.js);
    signed out, they lead to sign-in and back to the post. It's laid out from
    the blog's parts (components/blog/): meta, body (or members only), call to
    action, tags, like button and comments.
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
        @php $slug = data_get($post, 'slug'); @endphp
        <article class="post">
            <a class="post__back" href="{{ route('blog') }}">← All posts</a>
            <header class="post__head">
                <h1>{{ data_get($post, 'title') }}</h1>
                <x-blog.post-meta :minutes="$minutes" :post="$post" />
            </header>
            @if (data_get($post, 'imageUrl'))
                <img alt="" class="post__cover" referrerpolicy="no-referrer" src="{{ data_get($post, 'imageUrl') }}">
            @endif
            @if ($paywalled)
                <x-blog.members-only :sign-in-href="$signInHref" />
            @else
                {{-- Safe: PostHtml::safe rebuilt this from an allowlist. --}}
                <x-blog.post-body :html="$html" />
            @endif
            <x-blog.post-cta :post="$post" />
            <x-blog.post-tags :tags="data_get($post, 'tags') ?: []" />
            <x-blog.like-button :like-url="route('blog.like', $slug, false)" :likes="$likes" :sign-in-href="$signInHref" />
        </article>
        <x-blog.comments :comment-url="route('blog.comment', $slug, false)" :comments="$comments" :sign-in-href="$signInHref" />
    @endif
@endsection
