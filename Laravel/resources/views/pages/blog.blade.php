{{--
    The post list: pinned first, category and tag filters, older posts.
    App\Http\Controllers\BlogController@index.
--}}
@extends('layout')
@section('title', $active ? data_get($active, 'name').' — Blog' : 'Blog')
@push('head')
    <link rel="stylesheet" href="/bd-pages.css">
    <link rel="stylesheet" href="/bd-blog.css">
@endpush
@section('main_class', 'bd-page')
@section('content')
    @php
        /** This list with one filter changed and the paging reset. */
        $filterHref = function (string $key, ?string $value) use ($category, $tag): string {
            $next = array_filter(['category' => $category, 'tag' => $tag, $key => $value]);

            return route('blog').($next ? '?'.http_build_query($next) : '');
        };
    @endphp

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

        @if ($categories || $tags)
            <nav aria-label="Blog topics" class="blog-filters">
                @if ($categories)
                    <ul>
                        <li><a @if (! $category) aria-current="true" @endif href="{{ $filterHref('category', null) }}">All</a></li>
                        @foreach ($categories as $item)
                            <li><a @if ($category === data_get($item, 'id')) aria-current="true" @endif href="{{ $filterHref('category', data_get($item, 'id')) }}">{{ data_get($item, 'name') }}</a></li>
                        @endforeach
                    </ul>
                @endif
                @if ($tags)
                    <ul class="blog-filters__tags">
                        @foreach ($tags as $item)
                            <li><a @if ($tag === $item) aria-current="true" @endif href="{{ $filterHref('tag', $tag === $item ? null : $item) }}">#{{ $item }}</a></li>
                        @endforeach
                    </ul>
                @endif
            </nav>
        @endif

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
                    <li @class(['bd-card', 'post-card', 'post-card--lead' => $loop->first && ! $paged])>
                        <a class="post-card__link" href="{{ route('blog.show', data_get($post, 'slug')) }}">
                            @if (data_get($post, 'imageUrl'))
                                <img alt="" class="post-card__img" loading="lazy" referrerpolicy="no-referrer" src="{{ data_get($post, 'imageUrl') }}">
                            @endif
                            <div class="post-card__body">
                                <p class="post-card__meta">
                                    @if (data_get($post, 'isPinned'))<span class="bd-badge">Pinned</span>@endif
                                    <span>{{ \App\Support\PostHtml::date(data_get($post, 'publishedAt')) }}</span>
                                    <span>· {{ \App\Support\PostHtml::readingMinutes((string) (data_get($post, 'content') ?: data_get($post, 'excerpt', ''))) }} min read</span>
                                </p>
                                <h2>{{ data_get($post, 'title') }}</h2>
                                @if (data_get($post, 'excerpt'))
                                    <p class="post-card__excerpt">{{ data_get($post, 'excerpt') }}</p>
                                @endif
                                @if (data_get($post, 'authorName'))
                                    <p class="post-card__author">{{ data_get($post, 'authorName') }}</p>
                                @endif
                            </div>
                        </a>
                    </li>
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
