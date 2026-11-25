{{--
    The price for what's chosen times the quantity: "From" until every option
    is picked, the price each when buying more than one, Sold out when there's
    none. `price` is from Shop::priceFor(); <bd-product-form> keeps it current.
--}}
@props(['price', 'quantity' => 1])
@php $amount = $price['amount']; @endphp
<p class="product-detail__price" data-bd-price>
    <span class="product-detail__from" data-bd-from @if (! ($amount !== null && $price['from'])) hidden @endif>From</span> <span data-bd-amount>{{ $amount !== null ? \App\Support\Money::amount($amount * $quantity) : 'Sold out' }}</span><span class="product-detail__each" data-bd-each @if (! ($amount !== null && $quantity > 1)) hidden @endif>{{ $amount !== null && $quantity > 1 ? ' ('.\App\Support\Money::amount($amount).' each)' : '' }}</span>
</p>
