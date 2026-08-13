@extends('layout')
@section('title', data_get($product, 'name', 'Product'))
@section('content')
    <article class="product">
        <h1>{{ data_get($product, 'name') }}</h1>
        <p class="price">{{ \App\Support\Money::cents(data_get($product, 'cheapestPriceCents')) }}</p>
        <div class="description">{{ data_get($product, 'description') }}</div>

        <form method="POST" action="{{ route('cart.add') }}">
            @csrf
            <input type="hidden" name="productId" value="{{ data_get($product, 'id') }}">
            <label>Qty <input type="number" name="quantity" value="1" min="1"></label>
            <button type="submit">Add to cart</button>
        </form>
    </article>

    @if ($reviews)
        <section>
            <h2>Reviews</h2>
            @foreach ($reviews as $review)
                <blockquote>
                    <p>{{ data_get($review, 'text') }}</p>
                    <cite>{{ data_get($review, 'reviewerName', 'Anonymous') }} — {{ data_get($review, 'rating') }}/5</cite>
                </blockquote>
            @endforeach
        </section>
    @endif

    @if ($related)
        <section>
            <h2>Related</h2>
            <ul>
                @foreach ($related as $item)
                    <li><a href="{{ route('store.product', data_get($item, 'id')) }}">{{ data_get($item, 'name') }}</a></li>
                @endforeach
            </ul>
        </section>
    @endif
@endsection
