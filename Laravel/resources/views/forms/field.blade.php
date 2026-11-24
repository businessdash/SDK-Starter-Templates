{{-- One field: its label, its control (forms.control), its problem and its help. --}}
@php
    use App\Bd\Forms\FieldPath;
    use App\Bd\Forms\FormView;

    $key = $prefix.$field->id;
    $path = new FieldPath($field->id, $entries);
    $error = $v->errors[$path->key()] ?? null;
    $inputId = $v->id($key);
    $help = $field->str('helpText');
    $helpId = $help !== null ? "{$inputId}-help" : null;
    $errorId = $error !== null ? "{$inputId}-error" : null;
    $describedBy = implode(' ', array_filter([$errorId, $helpId]));
    $labelId = "{$inputId}-label";
    $single = FormView::singleControl($field);
    $showLabel = FormView::showsLabel($field);
    $labelledBy = $showLabel && ! $single ? $labelId : null;
    $value = $v->c->value($path);
    $model = FormView::model($key);
    // On a control: what describes it and whether it's wrong. On a group's container: what names it.
    $aria = ($describedBy !== '' ? ' aria-describedby="'.e($describedBy).'"' : '').($error !== null ? ' aria-invalid="true"' : '');
    $group = $labelledBy !== null ? ' aria-labelledby="'.e($labelledBy).'"' : '';
@endphp
<div @class(['bd-field', "bd-field--{$field->type}", 'bd-field--required' => $field->required, 'bd-field--error' => $error !== null]) data-field-id="{{ $field->id }}" data-bd-field="{{ FormView::cssKey($field) }}" data-bd-type="{{ $field->type }}" wire:key="field-{{ $key }}">
    @if ($showLabel)
        @if ($single)
            <label class="bd-field__label" id="{{ $labelId }}" for="{{ $inputId }}">{{ $field->label }}@if ($field->required)<span class="bd-field__required" aria-hidden="true"> *</span>@endif</label>
        @else
            <span class="bd-field__label" id="{{ $labelId }}">{{ $field->label }}@if ($field->required)<span class="bd-field__required" aria-hidden="true"> *</span>@endif</span>
        @endif
    @endif
    @include('forms.control')
    @if ($error !== null)
        <p class="bd-field__error" id="{{ $errorId }}">{{ $error }}</p>
    @endif
    @if ($help !== null)
        <p class="bd-field__help" id="{{ $helpId }}">{{ $help }}</p>
    @endif
</div>
