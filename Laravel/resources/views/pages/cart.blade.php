{{--
    The cart: plain forms (CartController), laid out from the shop's parts
    (components/shop/): a line per item, the subtotal, a coupon box and
    Checkout.
--}}
@extends('layout')
@section('title', 'Cart')
@section('subnav')
    <x-store-nav :count="$cartCount" />
@endsection
@section('content')
    <h1>Cart</h1>

    @php($items = data_get($cart, 'items', []))

    @if (! $items)
        <p class="muted">Your cart is empty. <a href="{{ route('store') }}">Browse the store</a>.</p>
    @else
        <ul class="cart-lines">
            @foreach ($items as $item)
                <x-shop.cart-line :item="$item" />
            @endforeach
        </ul>

        <x-shop.cart-summary :cart="$cart" />
        <x-shop.coupon-form />
        <x-shop.cart-actions />
    @endif
@endsection
