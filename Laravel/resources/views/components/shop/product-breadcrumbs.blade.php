{{-- Store / Category / This product. `product` is from Shop::productView(). --}}
@props(['product', 'storeHref' => '/store'])
<nav aria-label="Breadcrumb" class="crumbs">
    <a href="{{ $storeHref }}">Store</a>
    @if ($product['categoryId'])
        <span aria-hidden="true">/</span>
        <a href="{{ $storeHref }}?category={{ urlencode($product['categoryId']) }}">{{ $product['categoryName'] ?? 'Category' }}</a>
    @endif
    <span aria-hidden="true">/</span>
    <span aria-current="page">{{ $product['name'] }}</span>
</nav>
