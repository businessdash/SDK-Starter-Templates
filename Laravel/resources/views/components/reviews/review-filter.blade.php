{{-- All, then a link per platform (Google, Yelp…), when reviews come from more than one. --}}
@props(['sources' => [], 'source' => null])
@use('App\Support\Reviews')
@if (count($sources) > 1)
    <nav aria-label="Platform">
        <ul class="reviews-filter">
            <li><a href="{{ route('reviews', [], false) }}" aria-current="{{ $source === null ? 'true' : 'false' }}">All</a></li>
            @foreach ($sources as $s)
                <li><a href="{{ route('reviews', ['source' => $s], false) }}" aria-current="{{ $source === $s ? 'true' : 'false' }}">{{ Reviews::sourceLabel($s) }}</a></li>
            @endforeach
        </ul>
    </nav>
@endif
