{{-- One question: its choices (lettered, with "I don't know" when offered) or a box. --}}
@php
    $field = $q['field'];
    $base = 'bd-quiz-'.preg_replace('/[^\p{L}\p{N}_-]/u', '-', $field->id);
    $labelId = "{$base}-label";
    $errorId = "{$base}-error";
    $model = "answers.{$field->id}";
    $invalid = $q['error'] !== null ? ' aria-invalid="true" aria-describedby="'.e($errorId).'"' : '';
    $types = ['email' => 'email', 'url' => 'url', 'phone' => 'tel', 'tel' => 'tel', 'number' => 'number', 'date' => 'date', 'time' => 'time'];
    $placeholder = $field->str('placeholder');
@endphp
<fieldset class="bd-quiz__question" data-field-id="{{ $field->id }}" data-bd-type="{{ $field->type }}" wire:key="question-{{ $field->id }}">
    <legend class="bd-quiz__label" id="{{ $labelId }}">@if ($s['phase'] === 'all')<span class="bd-quiz__number">{{ $q['number'] }}.</span>@endif{{ $q['label'] }}</legend>
    @if ($q['choices'] !== null)
        <div class="bd-quiz__choices" role="{{ $q['multiple'] ? 'group' : 'radiogroup' }}" aria-labelledby="{{ $labelId }}" {!! $invalid !!}>
            @foreach ($q['choices'] as $choice)
                <label class="bd-quiz__choice" data-state="{{ $choice['state'] }}" @if ($q['locked']) data-locked @endif wire:key="choice-{{ $field->id }}-{{ $choice['letter'] }}">
                    <input class="bd-visually-hidden" type="{{ $q['multiple'] ? 'checkbox' : 'radio' }}" value="{{ $choice['label'] }}" @checked($choice['selected']) @disabled($q['locked']) wire:model.live.change="{{ $model }}">
                    <span class="bd-quiz__letter" aria-hidden="true">{{ $choice['letter'] }}</span><span class="bd-quiz__choice-label">{{ $choice['label'] }}</span>
                </label>
            @endforeach
            @if ($q['dontKnow'] !== null)
                <label class="bd-quiz__choice bd-quiz__choice--dont-know" data-state="{{ $q['dontKnow']['state'] }}" @if ($q['locked']) data-locked @endif wire:key="choice-{{ $field->id }}-dk">
                    @if ($q['multiple'])
                        <input class="bd-visually-hidden" type="checkbox" @checked($q['dontKnow']['selected']) @disabled($q['locked']) wire:model.live.change="dk.{{ $field->id }}">
                    @else
                        <input class="bd-visually-hidden" type="radio" value="{{ $dontKnowValue }}" @checked($q['dontKnow']['selected']) @disabled($q['locked']) wire:model.live.change="{{ $model }}">
                    @endif
                    <span class="bd-quiz__letter" aria-hidden="true">?</span><span class="bd-quiz__choice-label">{{ $q['dontKnow']['label'] }}</span>
                </label>
            @endif
        </div>
    @else
        @php($value = $q['value'] === null ? '' : \App\Bd\Forms\Js::string($q['value']))
        @switch ($field->type)
            @case ('textarea')
            @case ('long_text')
                <textarea class="bd-quiz__input" id="{{ $base }}" aria-labelledby="{{ $labelId }}" {!! $invalid !!} @disabled($q['locked']) wire:model.live.change="{{ $model }}">{{ $value }}</textarea>
                @break
            @case ('select')
                <select class="bd-quiz__input" id="{{ $base }}" aria-labelledby="{{ $labelId }}" {!! $invalid !!} @disabled($q['locked']) wire:model.live.change="{{ $model }}">
                    <option value="">{{ ($placeholder ?? '') !== '' ? $placeholder : 'Choose…' }}</option>
                    @foreach ($field->options() ?? [] as $option)
                        <option value="{{ $option }}" @selected($option === $value)>{{ $option }}</option>
                    @endforeach
                </select>
                @break
            @default
                <input class="bd-quiz__input" id="{{ $base }}" type="{{ $types[$field->type] ?? 'text' }}" value="{{ $value }}" @if (($placeholder ?? '') !== '') placeholder="{{ $placeholder }}" @endif aria-labelledby="{{ $labelId }}" {!! $invalid !!} @disabled($q['locked']) wire:model.live.change="{{ $model }}">
        @endswitch
    @endif
    @if ($q['error'] !== null)
        <p class="bd-quiz__field-error" id="{{ $errorId }}" role="alert">{{ $q['error'] }}</p>
    @endif
</fieldset>
