{{-- The store's other filters, as hidden fields, so a form changes only its own. --}}
@props(['query', 'except' => []])
@foreach (array_diff_key($query, array_flip($except)) as $name => $value)
    <input type="hidden" name="{{ $name }}" value="{{ $value }}">
@endforeach
