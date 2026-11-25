{{-- A line in the cart: name and option, the price each, Update the quantity (0 removes it), and Remove. --}}
@props(['item'])
<li>
    <span>
        {{ data_get($item, 'productName') }}@if (data_get($item, 'variantTitle')) · {{ data_get($item, 'variantTitle') }}@endif
        <span class="muted">{{ \App\Support\Money::amount(data_get($item, 'unitPrice')) }} each</span>
    </span>
    <form method="POST" action="{{ route('cart.update', data_get($item, 'id')) }}">
        @csrf @method('PATCH')
        <input type="number" name="quantity" value="{{ data_get($item, 'quantity', 1) }}" min="0">
        <button type="submit">Update</button>
    </form>
    <form method="POST" action="{{ route('cart.remove', data_get($item, 'id')) }}">
        @csrf @method('DELETE')
        <button type="submit">Remove</button>
    </form>
</li>
