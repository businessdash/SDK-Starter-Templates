{{-- A row of small product cards (related products). `products`: id, name, image, priceCents. --}}
@props(['title', 'products', 'storeHref' => '/store'])
@if ($products)
    <section class="product-rail">
        <h2 class="product-rail__title">{{ $title }}</h2>
        <ul class="product-rail__row">
            @foreach ($products as $product)
                <li>
                    <a class="bd-card product-rail__card" href="{{ $storeHref }}/{{ rawurlencode($product['id']) }}">@if ($product['image'])<img alt="" loading="lazy" referrerpolicy="no-referrer" src="{{ $product['image'] }}">@else<span aria-hidden="true" class="product-rail__noimg"></span>@endif<span class="product-rail__name">{{ $product['name'] }}</span>@if ($product['priceCents'] !== null)<span class="product-rail__price">{{ \App\Support\Money::cents($product['priceCents']) }}</span>@endif</a>
                </li>
            @endforeach
        </ul>
    </section>
@endif
