{{-- All products, then a link per category with its count; the chosen one is marked. --}}
@props(['categories', 'counts' => [], 'selected' => null, 'query'])
@use('App\Support\Shop')
@if ($categories)
    <div class="store-facet">
        <p class="store-facet__title">Category</p>
        <ul class="store-facet__list">
            <li>
                <a @class(['store-facet__item', 'store-facet__item--active' => ! $selected]) href="{{ Shop::storeHref($query, ['category' => null]) }}">All products</a>
            </li>
            @foreach ($categories as $category)
                @php $active = $selected === data_get($category, 'id'); @endphp
                <li>
                    <a @class(['store-facet__item', 'store-facet__item--row', 'store-facet__item--active' => $active]) href="{{ Shop::storeHref($query, ['category' => $active ? null : data_get($category, 'id')]) }}">
                        <span>{{ data_get($category, 'name') }}</span>
                        <span class="store-facet__count">{{ $counts[data_get($category, 'id')] ?? 0 }}</span>
                    </a>
                </li>
            @endforeach
        </ul>
    </div>
@endif
