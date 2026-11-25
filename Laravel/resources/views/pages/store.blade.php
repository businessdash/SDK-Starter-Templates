{{--
    The product list: search, category, price and rating filters with a sort.
    Each card saves to the wishlist or the comparison (<bd-save-buttons>), and
    <bd-compare-bar> shows the picks. App\Http\Controllers\StoreController@index.
--}}
@extends('layout')
@section('title', 'Store')
@section('subnav')
    <x-store-nav :count="$cartCount" />
@endsection
@section('main_class', 'bd-page')
@section('content')
    @php
        /** This list with some filters changed (null removes one). */
        $hrefWith = function (array $changes) use ($query): string {
            $next = array_filter(array_merge($query, $changes), static fn ($v) => $v !== null && $v !== '');

            return route('store').($next ? '?'.http_build_query($next) : '');
        };
        /** The filters a form leaves alone, carried along as hidden fields. */
        $keep = static fn (string ...$replaced): array => array_diff_key($query, array_flip($replaced));
    @endphp

    <div class="bd-section__lead">
        <span class="bd-section__eyebrow">Shop</span>
        <h1 class="bd-section__title">Products</h1>
        <p class="bd-section__sub">Filter, sort, and open a product to choose its options and add it to your cart.</p>
    </div>

    @if (! $configured)
        <div class="bd-empty">
            The store isn't connected yet. Set <code>BD_SITE_ID</code> and <code>BD_API_KEY</code> in <code>.env</code>.
        </div>
    @elseif ($listing === null)
        <div class="bd-empty">The store is temporarily unavailable. Please check back soon.</div>
    @else
        <div class="store-layout">
            <aside aria-label="Product filters" class="store-sidebar">
                <search>
                    <form action="{{ route('store') }}" method="get">
                        <label class="bd-label" for="store-search">Search</label>
                        <input autocomplete="off" class="bd-input" id="store-search" name="q" placeholder="Search products…" type="search" value="{{ $query['q'] ?? '' }}">
                        @foreach ($keep('q') as $name => $value)
                            <input type="hidden" name="{{ $name }}" value="{{ $value }}">
                        @endforeach
                    </form>
                </search>

                @if ($categories)
                    <div class="store-facet">
                        <p class="store-facet__title">Category</p>
                        <ul class="store-facet__list">
                            <li>
                                <a @class(['store-facet__item', 'store-facet__item--active' => ! $filters['categoryId']]) href="{{ $hrefWith(['category' => null]) }}">All products</a>
                            </li>
                            @foreach ($categories as $category)
                                @php $active = $filters['categoryId'] === data_get($category, 'id'); @endphp
                                <li>
                                    <a @class(['store-facet__item', 'store-facet__item--row', 'store-facet__item--active' => $active]) href="{{ $hrefWith(['category' => $active ? null : data_get($category, 'id')]) }}">
                                        <span>{{ data_get($category, 'name') }}</span>
                                        <span class="store-facet__count">{{ $counts[data_get($category, 'id')] ?? 0 }}</span>
                                    </a>
                                </li>
                            @endforeach
                        </ul>
                    </div>
                @endif

                <form action="{{ route('store') }}" class="store-facet" method="get">
                    <p class="store-facet__title">Price</p>
                    <div class="store-price">
                        <input aria-label="Lowest price" class="bd-input" inputmode="decimal" name="priceMin" placeholder="{{ $priceRange ? '$'.floor($priceRange['minDollars'] ?? 0) : 'Min' }}" value="{{ $query['priceMin'] ?? '' }}">
                        <span aria-hidden="true" class="store-price__sep">–</span>
                        <input aria-label="Highest price" class="bd-input" inputmode="decimal" name="priceMax" placeholder="{{ $priceRange ? '$'.ceil($priceRange['maxDollars'] ?? 0) : 'Max' }}" value="{{ $query['priceMax'] ?? '' }}">
                    </div>
                    @foreach ($keep('priceMin', 'priceMax') as $name => $value)
                        <input type="hidden" name="{{ $name }}" value="{{ $value }}">
                    @endforeach
                    <button class="bd-btn bd-btn--ghost store-price__apply" type="submit">Apply</button>
                </form>

                <div class="store-facet">
                    <p class="store-facet__title">Rating</p>
                    <ul class="store-facet__list">
                        @foreach ([4, 3, 2] as $stars)
                            @php $active = $filters['minRating'] === $stars; @endphp
                            <li>
                                <a @class(['store-facet__item', 'store-facet__rating', 'store-facet__item--active' => $active]) href="{{ $hrefWith(['rating' => $active ? null : $stars]) }}">
                                    <x-stars :rating="$stars" /><span class="store-facet__count">&amp; up</span>
                                </a>
                            </li>
                        @endforeach
                    </ul>
                </div>

                @if ($hasFilters)
                    <a class="store-clear" href="{{ route('store') }}">Clear all filters</a>
                @endif
            </aside>

            <div class="store-results">
                <div class="store-results__bar">
                    <p class="bd-loading">{{ count($products) }} {{ count($products) === 1 ? 'product' : 'products' }}</p>
                    <form action="{{ route('store') }}" class="store-sort" method="get">
                        <label for="store-sort">Sort</label>
                        <select class="bd-select" id="store-sort" name="sort" onchange="this.form.requestSubmit()">
                            @foreach (\App\Http\Controllers\StoreController::SORTS as $value => $label)
                                <option value="{{ $value }}" @selected($filters['sort'] === $value)>{{ $label }}</option>
                            @endforeach
                        </select>
                        @foreach ($keep('sort') as $name => $value)
                            <input type="hidden" name="{{ $name }}" value="{{ $value }}">
                        @endforeach
                        <noscript><button class="bd-btn bd-btn--ghost" type="submit">Sort</button></noscript>
                    </form>
                </div>

                @if (! $products)
                    <div class="bd-empty">
                        @if ($hasFilters)
                            No products match these filters. Try clearing a filter or broadening your search.
                        @else
                            No live products yet. Add and publish products in the BD dashboard and they'll appear here.
                        @endif
                    </div>
                @else
                    <div class="bd-grid-3">
                        @foreach ($products as $product)
                            @php
                                $id = data_get($product, 'id');
                                $name = data_get($product, 'name') ?: 'Untitled';
                                $image = data_get($product, 'coverImage');
                                $price = data_get($product, 'cheapestPriceCents');
                                $reviews = (int) data_get($product, 'reviewCount', 0);
                            @endphp
                            <div class="bd-card product-card">
                                <a class="product-card__link" href="{{ route('store.product', $id) }}">
                                    <div class="product-card__media">
                                        @if ($image)
                                            <img alt="{{ $name }}" class="product-card__img" loading="lazy" referrerpolicy="no-referrer" src="{{ $image }}">
                                        @else
                                            <div class="product-card__noimg">No image</div>
                                        @endif
                                        <div class="product-card__badges">
                                            @if (data_get($product, 'isBestSeller'))<span class="bd-badge">Best seller</span>@endif
                                            @if (data_get($product, 'isNew'))<span class="bd-badge">New</span>@endif
                                            @if (data_get($product, 'isOnSale'))<span class="bd-badge product-card__badge--sale">Sale</span>@endif
                                        </div>
                                    </div>
                                    <div class="product-card__body">
                                        <h3>{{ $name }}</h3>
                                        @if ($reviews > 0)
                                            <div class="product-card__rating">
                                                <x-stars :rating="(float) data_get($product, 'avgRating', 0)" />
                                                <span class="product-card__count">({{ $reviews }})</span>
                                            </div>
                                        @endif
                                        <div class="product-card__price">
                                            <span class="product-card__amount">
                                                @if ($price !== null)
                                                    {{ data_get($product, 'hasMultipleVariants') ? 'From ' : '' }}{{ \App\Support\Money::cents($price) }}
                                                @else
                                                    View details
                                                @endif
                                            </span>
                                            @if (data_get($product, 'isOnSale') && data_get($product, 'comparePriceCents') !== null)
                                                <span class="product-card__compare">{{ \App\Support\Money::cents(data_get($product, 'comparePriceCents')) }}</span>
                                            @endif
                                        </div>
                                        @if (data_get($product, 'isLowStock'))
                                            <span class="product-card__lowstock">Low stock</span>
                                        @endif
                                    </div>
                                </a>
                                <div class="product-card__save">
                                    <bd-save-buttons compact data-product="{{ json_encode(['id' => $id, 'name' => $name, 'image' => $image, 'priceCents' => $price]) }}"></bd-save-buttons>
                                </div>
                            </div>
                        @endforeach
                    </div>
                @endif
                <bd-compare-bar></bd-compare-bar>
            </div>
        </div>
    @endif
@endsection
