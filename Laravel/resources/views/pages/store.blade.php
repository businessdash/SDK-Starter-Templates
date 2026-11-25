{{--
    The product list: search, category, price and rating filters with a sort,
    all plain links and forms in the URL. App\Http\Controllers\StoreController@index.
    It's laid out from the shop's parts (components/shop/), one Blade
    component each: the filters, the sort, and a product card per product,
    which saves to the wishlist or the comparison (<bd-save-buttons>);
    <x-shop.compare-bar> shows the picks.
--}}
@extends('layout')
@section('title', 'Store')
@section('subnav')
    <x-store-nav :count="$cartCount" />
@endsection
@section('main_class', 'bd-page')
@section('content')
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
                <x-shop.store-search :query="$query" />
                <x-shop.category-filter :categories="$categories" :counts="$counts" :query="$query" :selected="$filters['categoryId']" />
                <x-shop.price-filter :query="$query" :range="$priceRange" />
                <x-shop.rating-filter :query="$query" :selected="$filters['minRating']" />
                @if ($hasFilters)
                    <x-shop.clear-filters />
                @endif
            </aside>

            <div class="store-results">
                <div class="store-results__bar">
                    <p class="bd-loading">{{ count($products) }} {{ count($products) === 1 ? 'product' : 'products' }}</p>
                    <x-shop.sort-select :query="$query" :selected="$filters['sort']" />
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
                    <x-shop.product-grid :products="$products" />
                @endif
                <x-shop.compare-bar :store-href="route('store', [], false)" />
            </div>
        </div>
    @endif
@endsection
