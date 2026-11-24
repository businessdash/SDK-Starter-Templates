{{-- Two boxes side by side: a date range, a time block, an appointment. --}}
<div class="bd-grid bd-grid--2" role="group" id="{{ $inputId }}" {!! $group !!}>
    @foreach ($cells as [$part, $label, $type])
        <label class="bd-grid__cell"><span class="bd-grid__label">{{ $label }}</span><input class="bd-input" type="{{ $type }}" id="{{ $inputId }}-{{ $part }}" value="{{ \App\Bd\Forms\FormView::part($value, $part) }}" wire:model="{{ \App\Bd\Forms\FormView::model($key, $part) }}"></label>
    @endforeach
</div>
