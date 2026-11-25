{{-- Sort the list (?sort); it applies as soon as it changes, or with Sort without JavaScript. --}}
@props(['selected', 'query'])
<form action="{{ route('store') }}" class="store-sort" method="get">
    <label for="store-sort">Sort</label>
    <select class="bd-select" id="store-sort" name="sort" onchange="this.form.requestSubmit()">
        @foreach (\App\Http\Controllers\StoreController::SORTS as $value => $label)
            <option value="{{ $value }}" @selected($selected === $value)>{{ $label }}</option>
        @endforeach
    </select>
    <x-shop.kept-fields :except="['sort']" :query="$query" />
    <noscript><button class="bd-btn bd-btn--ghost" type="submit">Sort</button></noscript>
</form>
