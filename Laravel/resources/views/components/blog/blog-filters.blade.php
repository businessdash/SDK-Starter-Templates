{{-- All and a link per category, then the tags; choosing one resets the paging. --}}
@props(['categories' => [], 'tags' => [], 'category' => null, 'tag' => null])
@php
    /** This list with one filter changed and the paging reset. */
    $filterHref = function (string $key, ?string $value) use ($category, $tag): string {
        $next = array_filter(['category' => $category, 'tag' => $tag, $key => $value]);

        return route('blog').($next ? '?'.http_build_query($next) : '');
    };
@endphp
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
