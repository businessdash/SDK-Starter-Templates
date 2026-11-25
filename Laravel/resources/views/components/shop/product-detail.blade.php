{{--
    The whole product page: photos that follow the chosen option, option and
    size buttons, the price for what's chosen, add to cart, save and compare,
    share, details, add-ons, reviews, related products and what was viewed
    before.

    It's laid out from the parts in this folder, one file each, drawn here as
    the page opens (the first variant that can be bought, nothing else
    chosen; the rules are App\Support\Shop). <bd-gallery> and
    <bd-product-form> (public/shop/shop-elements.js) bring them to life: they
    find the parts by their data-bd attributes, so move, restyle or drop any
    part, or lay them out your own way.

    `data`: product, reviews, addons, related, moreReviewsHref
    (StoreController@show).
--}}
@props(['data', 'storeHref' => '/store', 'cartHref' => '/cart', 'addUrl', 'contactHref' => '/#contact'])
@use('App\Support\Shop')
@php
    $view = Shop::productView($data['product']);
    $variantId = Shop::defaultVariant($view)['id'] ?? '';
    $price = Shop::priceFor($view, $variantId);
    $summary = Shop::productSummary($view, $variantId);
    $related = array_map(fn ($rp) => Shop::relatedCard($rp), $data['related'] ?? []);
@endphp
<x-shop.product-breadcrumbs :product="$view" :store-href="$storeHref" />

<div class="product-detail">
    <x-shop.product-gallery :name="$view['name']" :product-id="$view['id']" :sets="Shop::photoSets($view)" :variant-id="$variantId" />

    <div class="product-detail__info bd-card">
        <x-shop.product-title :product="$view" :reviews="$data['reviews'] ?? null" />
        <bd-product-form data-add-url="{{ $addUrl }}" data-cart-href="{{ $cartHref }}">
            <x-element-data :value="['product' => $data['product']]" />
            <x-shop.product-price :price="$price" />
            @if ($view['description'])<p class="product-detail__desc">{{ $view['description'] }}</p>@endif
            <x-shop.variant-picker :selected="$variantId" :show-prices="! Shop::optionGroupsFor($view, $variantId)" :variants="$view['variants']" />
            @foreach (Shop::allOptionGroups($view) as $group)
                <x-shop.option-picker :group="$group" :hidden="$group['variantId'] !== null && $group['variantId'] !== $variantId" />
            @endforeach
            <x-shop.stock-note :stock="$price['stock']" />

            <div class="buy">
                <x-shop.quantity-stepper :max="$price['stock']" />
                <x-shop.add-to-cart-button :price="$price" />
            </div>
            <x-shop.cart-notice :cart-href="$cartHref" />

            <div class="product-detail__tools">
                <x-shop.save-buttons :product="$summary" />
                <x-shop.share-button :title="$view['name']" />
            </div>
            <x-shop.product-policies :contact-href="$contactHref" />
        </bd-product-form>
    </div>
</div>

<x-shop.product-specs :features="$view['features']" :specs="$view['specs']" />
<x-shop.product-addons :add-url="$addUrl" :addons="$data['addons'] ?? []" />
<x-shop.product-reviews :more-href="$data['moreReviewsHref'] ?? null" :reviews="$data['reviews'] ?? null" />
<x-shop.product-rail :products="$related" :store-href="$storeHref" title="You may also like" />
<x-shop.recently-viewed :product="$summary" :store-href="$storeHref" />
<x-shop.compare-bar :store-href="$storeHref" />
