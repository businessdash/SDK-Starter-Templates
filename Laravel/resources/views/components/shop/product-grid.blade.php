{{-- The products, three across on wide screens. --}}
@props(['products'])
<div class="bd-grid-3">
    @foreach ($products as $product)
        <x-shop.product-card :product="$product" />
    @endforeach
</div>
