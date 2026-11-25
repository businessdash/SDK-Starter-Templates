{{-- A coupon code with Apply. --}}
<form method="POST" action="{{ route('cart.coupon') }}" class="coupon">
    @csrf
    <input type="text" name="code" placeholder="Coupon code">
    <button type="submit">Apply</button>
</form>
