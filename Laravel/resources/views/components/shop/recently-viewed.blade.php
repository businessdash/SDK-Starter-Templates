{{-- What this browser opened before, as a rail; this product joins the list for next time. --}}
@props(['product', 'storeHref' => '/store'])
<bd-recently-viewed data-product="{{ json_encode($product) }}" data-store-href="{{ $storeHref }}"></bd-recently-viewed>
