{{-- 4, 3 or 2 stars & up (?rating); choosing the chosen one again clears it. --}}
@props(['selected' => null, 'query'])
@use('App\Support\Shop')
<div class="store-facet">
    <p class="store-facet__title">Rating</p>
    <ul class="store-facet__list">
        @foreach ([4, 3, 2] as $stars)
            @php $active = $selected === $stars; @endphp
            <li>
                <a @class(['store-facet__item', 'store-facet__rating', 'store-facet__item--active' => $active]) href="{{ Shop::storeHref($query, ['rating' => $active ? null : $stars]) }}">
                    <x-stars :rating="$stars" /><span class="store-facet__count">&amp; up</span>
                </a>
            </li>
        @endforeach
    </ul>
</div>
