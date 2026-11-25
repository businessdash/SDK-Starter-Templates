{{-- The subtotal. --}}
@props(['cart'])
<p class="total">Subtotal: {{ \App\Support\Money::amount(data_get($cart, 'subtotal')) }}</p>
