{{--
    One product. The controller reads the product, its reviews, add-ons and
    related products; <x-shop.product-detail> (components/shop/) lays the
    page out from the shop's parts, one Blade component each: option photos,
    option and size buttons, the price for what's chosen, add to cart (POST
    /api/bd/cart/add), save, compare, share, add-ons, reviews, related and
    recently viewed.
--}}
@extends('layout')
@section('title', $data ? data_get($data, 'product.name').' — Store' : 'Product — Store')
@section('subnav')
    <x-store-nav :count="$cartCount" />
@endsection
@section('main_class', 'bd-page')
@section('content')
    @if (! $configured)
        <div class="bd-empty">
            The store isn't connected yet. Set <code>BD_SITE_ID</code> and <code>BD_API_KEY</code> in <code>.env</code>.
        </div>
    @elseif ($unavailable)
        <div class="bd-empty">The store is temporarily unavailable. Please check back soon.</div>
    @elseif (! $data)
        <div class="bd-empty">That product isn't available. <a href="{{ route('store') }}">Browse the store</a></div>
    @else
        <x-shop.product-detail :add-url="route('cart.add.json', [], false)" :cart-href="route('cart', [], false)" :data="$data" :store-href="route('store', [], false)" />
    @endif
@endsection
