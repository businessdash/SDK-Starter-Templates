{{--
    The bar under the header on every store and plan page: products and plans
    on the left; wishlist, compare and the cart with their counts on the right.

    The cart count comes from the server; after that <bd-cart-count> follows
    each `bd:cart-count` event the product page sends when it adds. The
    wishlist and compare lists live in this browser, so the shop elements
    (public/shop/shop-elements.js) fill in their counts there.
--}}
@props(['count' => 0])

@push('head')
    <link rel="stylesheet" href="/bd-pages.css">
    <link rel="stylesheet" href="/bd-shop.css">
@endpush
@push('scripts')
    <script type="module" src="/shop/shop-elements.js"></script>
@endpush

<nav aria-label="Store" class="store-nav">
    <div class="store-nav__links">
        <a href="{{ route('store') }}">Products</a>
        <a href="{{ route('subscriptions') }}">Plans</a>
    </div>
    <div class="store-nav__links">
        <a href="{{ route('store.wishlist') }}">Wishlist<bd-saved-count data-list="wishlist"></bd-saved-count></a>
        <a href="{{ route('store.compare') }}">Compare<bd-saved-count data-list="compare"></bd-saved-count></a>
        <a class="store-nav__cart" href="{{ route('cart') }}">Cart<bd-cart-count data-count="{{ $count }}">@if ($count > 0)<span class="store-nav__badge">{{ $count }}</span>@endif</bd-cart-count></a>
    </div>
</nav>
