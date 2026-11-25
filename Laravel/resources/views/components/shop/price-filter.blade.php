{{-- Lowest and highest price, with Apply (?priceMin, ?priceMax). `range` is the store's price range. --}}
@props(['range' => null, 'query'])
<form action="{{ route('store') }}" class="store-facet" method="get">
    <p class="store-facet__title">Price</p>
    <div class="store-price">
        <input aria-label="Lowest price" class="bd-input" inputmode="decimal" name="priceMin" placeholder="{{ $range ? '$'.floor($range['minDollars'] ?? 0) : 'Min' }}" value="{{ $query['priceMin'] ?? '' }}">
        <span aria-hidden="true" class="store-price__sep">–</span>
        <input aria-label="Highest price" class="bd-input" inputmode="decimal" name="priceMax" placeholder="{{ $range ? '$'.ceil($range['maxDollars'] ?? 0) : 'Max' }}" value="{{ $query['priceMax'] ?? '' }}">
    </div>
    <x-shop.kept-fields :except="['priceMin', 'priceMax']" :query="$query" />
    <button class="bd-btn bd-btn--ghost store-price__apply" type="submit">Apply</button>
</form>
