{{-- Add to cart; "Choose options" until every option is picked, Sold out when there's none. --}}
@props(['price'])
<button class="bd-btn buy__add" data-bd-add @disabled(! $price['ready']) type="button">{{ $price['amount'] === null ? 'Sold out' : (! $price['ready'] ? 'Choose options' : 'Add to cart') }}</button>
