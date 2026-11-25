{{-- Checkout: on to Stripe. --}}
<form method="POST" action="{{ route('cart.checkout') }}">
    @csrf
    <button type="submit" class="button">Checkout</button>
</form>
