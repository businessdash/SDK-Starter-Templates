{{-- A repeater: a row of its fields per entry, with Remove and Add. --}}
@php($r = \App\Bd\Forms\FormView::repeater($field, $value))
<div class="bd-repeater">
    @for ($row = 0; $row < $r['count']; $row++)
        <fieldset class="bd-repeater__row" wire:key="entry-{{ $key }}-{{ $row }}">
            <legend class="bd-repeater__legend">{{ $r['item'] }} {{ $row + 1 }}</legend>
            @include('forms.tree', ['fields' => $field->children ?? [], 'prefix' => "{$key}.{$row}.", 'entries' => $path->entry($row), 'flat' => true])
            @if ($r['count'] > $r['least'])
                <button class="bd-btn bd-btn--ghost bd-btn--sm bd-repeater__remove" type="button" wire:click="removeRow(@js($field->id), @js($entries), {{ $row }})">Remove {{ \App\Bd\Forms\Js::lower($r['item']) }} {{ $row + 1 }}</button>
            @endif
        </fieldset>
    @endfor
    @if ($r['count'] < $r['most'])
        <button class="bd-btn bd-btn--ghost bd-repeater__add" type="button" wire:click="addRow(@js($field->id), @js($entries))">{{ $r['add'] }}</button>
    @endif
</div>
