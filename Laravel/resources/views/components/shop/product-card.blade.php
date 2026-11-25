{{--
    A product in the list: photo with Best seller / New / Sale badges, name,
    stars, price, Low stock, and ♡ Save and ⇄ Compare. `product` is a card
    from `storefront.listProductsWithMeta`.
--}}
@props(['product'])
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
        <x-shop.save-buttons compact :product="['id' => $id, 'name' => $name, 'image' => $image, 'priceCents' => $price]" />
    </div>
</div>
