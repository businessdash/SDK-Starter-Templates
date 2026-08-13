@extends('layout')
@section('title', 'Cart')
@section('content')
    <h1>Cart</h1>

    @php($items = data_get($cart, 'items', []))

    @if (! $items)
        <p class="muted">Your cart is empty. <a href="{{ route('store') }}">Browse the store</a>.</p>
    @else
        <ul class="cart-lines">
            @foreach ($items as $item)
                <li>
                    <span>{{ data_get($item, 'name') }}</span>
                    <form method="POST" action="{{ route('cart.update', data_get($item, 'id')) }}">
                        @csrf @method('PATCH')
                        <input type="number" name="quantity" value="{{ data_get($item, 'quantity', 1) }}" min="0">
                        <button type="submit">Update</button>
                    </form>
                    <form method="POST" action="{{ route('cart.remove', data_get($item, 'id')) }}">
                        @csrf @method('DELETE')
                        <button type="submit">Remove</button>
                    </form>
                </li>
            @endforeach
        </ul>

        <p class="total">Subtotal: {{ \App\Support\Money::amount(data_get($cart, 'subtotal')) }}</p>

        <form method="POST" action="{{ route('cart.coupon') }}" class="coupon">
            @csrf
            <input type="text" name="code" placeholder="Coupon code">
            <button type="submit">Apply</button>
        </form>

        <form method="POST" action="{{ route('cart.checkout') }}">
            @csrf
            <button type="submit" class="button">Checkout</button>
        </form>
    @endif
@endsection
