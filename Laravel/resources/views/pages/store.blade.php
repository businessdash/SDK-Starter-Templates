@extends('layout')
@section('title', 'Store')
@section('content')
    <h1>Store</h1>

    <form method="GET" class="filters">
        <input type="search" name="search" value="{{ $search }}" placeholder="Search products">
        <select name="sort">
            <option value="">Featured</option>
            <option value="newest">Newest</option>
            <option value="price-asc">Price, low to high</option>
            <option value="price-desc">Price, high to low</option>
            <option value="rating-desc">Best rated</option>
        </select>
        <button type="submit">Filter</button>
    </form>

    @forelse ($products as $product)
        @if ($loop->first)<ul class="grid">@endif
        <li class="card">
            <a href="{{ route('store.product', data_get($product, 'id')) }}">
                <h2>{{ data_get($product, 'name') }}</h2>
                <p class="price">{{ \App\Support\Money::cents(data_get($product, 'cheapestPriceCents')) }}</p>
            </a>
            <form method="POST" action="{{ route('cart.add') }}">
                @csrf
                <input type="hidden" name="productId" value="{{ data_get($product, 'id') }}">
                <button type="submit">Add to cart</button>
            </form>
        </li>
        @if ($loop->last)</ul>@endif
    @empty
        <p class="muted">No products yet. Add some in the BIAB dashboard, or connect this app to a site.</p>
    @endforelse
@endsection
