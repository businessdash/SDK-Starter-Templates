{{-- Search the products (?q=); Enter searches. --}}
@props(['query'])
<search>
    <form action="{{ route('store') }}" method="get">
        <label class="bd-label" for="store-search">Search</label>
        <input autocomplete="off" class="bd-input" id="store-search" name="q" placeholder="Search products…" type="search" value="{{ $query['q'] ?? '' }}">
        <x-shop.kept-fields :except="['q']" :query="$query" />
    </form>
</search>
