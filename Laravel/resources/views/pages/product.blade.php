{{--
    One product. The controller reads the product, its reviews, add-ons and
    related products, and <bd-product> (public/shop/shop-elements.js) draws the
    page from that data: option photos, option and size buttons, the price for
    what's chosen, add to cart (POST /api/bd/cart/add), save, compare, share,
    add-ons, reviews, related and recently viewed.
--}}
@extends('layout')
@section('title', $data ? data_get($data, 'product.name').' — Store' : 'Product — Store')
@section('subnav')
    <x-store-nav :count="$cartCount" />
@endsection
@section('main_class', 'bd-page')
@section('content')
    @php $description = is_string(data_get($data, 'product.description')) ? data_get($data, 'product.description') : null; @endphp
    @if (! $configured)
        <div class="bd-empty">
            The store isn't connected yet. Set <code>BD_SITE_ID</code> and <code>BD_API_KEY</code> in <code>.env</code>.
        </div>
    @elseif ($unavailable)
        <div class="bd-empty">The store is temporarily unavailable. Please check back soon.</div>
    @elseif (! $data)
        <div class="bd-empty">That product isn't available. <a href="{{ route('store') }}">Browse the store</a></div>
    @else
        <bd-product data-add-url="{{ route('cart.add.json', [], false) }}" data-cart-href="{{ route('cart', [], false) }}" data-contact-href="/#contact">
            <x-element-data :value="$data" />
            <noscript>
                <h1>{{ data_get($data, 'product.name') }}</h1>
                @if ($description)<p>{{ $description }}</p>@endif
                <p>Turn on JavaScript to choose options and add this to your cart.</p>
            </noscript>
        </bd-product>
    @endif
@endsection
