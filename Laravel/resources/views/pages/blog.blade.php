{{--
    The post list: pinned first, category and tag filters, older posts.
    App\Http\Controllers\BlogController@index. It's laid out from the blog's
    parts (components/blog/): the filters and a post card per post.
--}}
@extends('layout')
@section('title', $active ? data_get($active, 'name').' — Blog' : 'Blog')
@push('head')
    <link rel="stylesheet" href="/bd-pages.css">
    <link rel="stylesheet" href="/bd-blog.css">
@endpush
@section('main_class', 'bd-page')
@section('content')
    @if (! $configured)
        <div class="bd-empty">The blog isn't connected yet. Add your BD env, then publish a post in Business Dash.</div>
    @else
        <div class="bd-section__lead">
            <span class="bd-section__eyebrow">Blog</span>
            <h1 class="bd-section__title">{{ data_get($active, 'name', 'From the blog') }}</h1>
            @if (data_get($active, 'description'))
                <p class="bd-section__sub">{{ data_get($active, 'description') }}</p>
            @endif
        </div>

        <x-blog.blog-filters :categories="$categories" :category="$category" :tag="$tag" :tags="$tags" />

        @if (! $posts)
            <div class="bd-empty">
                @if ($tag || $category)
                    No posts here yet.
                @else
                    No posts published yet. Write one in Business Dash and it'll appear here.
                @endif
            </div>
        @else
            <ul class="posts">
                @foreach ($posts as $post)
                    <x-blog.post-card :lead="$loop->first && ! $paged" :post="$post" />
                @endforeach
            </ul>
            @if ($nextCursor !== null)
                <p class="posts__more">
                    <a class="bd-btn bd-btn--ghost" href="{{ route('blog').'?'.http_build_query(array_filter(['category' => $category, 'cursor' => $nextCursor], static fn ($v) => $v !== null)) }}">Older posts</a>
                </p>
            @endif
        @endif
    @endif
@endsection
