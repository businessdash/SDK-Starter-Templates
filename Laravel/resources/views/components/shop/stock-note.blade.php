{{-- "Only 3 left", at five or fewer. --}}
@props(['stock' => null])
@php $low = $stock !== null && $stock > 0 && $stock <= 5; @endphp
<p class="product-detail__stock" data-bd-stock @if (! $low) hidden @endif>{{ $low ? "Only {$stock} left" : '' }}</p>
