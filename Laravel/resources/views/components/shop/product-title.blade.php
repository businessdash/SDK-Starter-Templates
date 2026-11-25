{{-- The category, the name, and the stars linking to the reviews. --}}
@props(['product', 'reviews' => null])
@php $count = (int) data_get($reviews, 'totalCount', 0); $avg = (float) data_get($reviews, 'avgRating', 0); @endphp
<div>
    @if ($product['categoryName'])<p class="product-detail__eyebrow">{{ $product['categoryName'] }}</p>@endif
    <h1>{{ $product['name'] }}</h1>
    @if ($count > 0)
        <a class="product-detail__rating" href="#reviews"><x-stars :rating="$avg" /><span>{{ number_format($avg, 1) }} · {{ $count }} reviews</span></a>
    @endif
</div>
