{{-- ♡ Save and ⇄ Compare for a product (`product`: id, name, image, priceCents). --}}
@props(['product', 'compact' => false])
<bd-save-buttons @if ($compact) compact @endif data-product="{{ json_encode($product) }}"></bd-save-buttons>
