{{--
    A field's control. Every box binds to `input.<key>` (wire:model), which
    the form sends when a box changes; the value attributes are there for the
    first paint. A picked file goes to `uploads.<slot>` and is held until Submit.
--}}
@php
    use App\Bd\Forms\Calculation;
    use App\Bd\Forms\FormView;
    use App\Bd\Forms\Json;

    $placeholder = $field->str('placeholder');
    $autocomplete = FormView::autocomplete($field);
    $text = FormView::str($value);
@endphp
@switch ($field->type)
    @case ('title')
        <h2 class="bd-field__title">{{ $field->label }}</h2>
        @break
    @case ('subtitle')
        <h3 class="bd-field__subtitle">{{ $field->label }}</h3>
        @break
    @case ('separator')
        <hr class="bd-field__separator">
        @break
    @case ('richtext')
    @case ('body_text')
        {{-- BD publishes `content` already sanitized. --}}
        @if ($field->str('content') !== null)
            <div class="bd-field__richtext bd-prose">{!! $field->str('content') !!}</div>
        @endif
        @break
    @case ('image')
        @if (($src = $field->config('imageConfig', 'src')) !== null && $src !== '')
            <img class="bd-field__image" src="{{ $src }}" alt="{{ $field->config('imageConfig', 'alt') ?? '' }}">
        @endif
        @break
    @case ('textarea')
    @case ('rich_text_input')
        <textarea class="bd-textarea" id="{{ $inputId }}" rows="{{ $field->config('textareaConfig', 'rows') ?? 4 }}" placeholder="{{ $placeholder ?? '' }}" @if ($autocomplete) autocomplete="{{ $autocomplete }}" @endif {!! $aria !!} wire:model="{{ $model }}">{{ $text }}</textarea>
        @break
    @case ('select')
        <select class="bd-select" id="{{ $inputId }}" {!! $aria !!} wire:model="{{ $model }}">
            <option value="">{{ $placeholder ?? 'Select…' }}</option>
            @foreach ($field->options() ?? [] as $option)
                <option value="{{ $option }}" @selected($text === $option)>{{ $option }}</option>
            @endforeach
        </select>
        @break
    @case ('radio')
    @case ('checkbox')
        @php($radio = $field->type === 'radio')
        @php($picked = $radio ? [$text] : array_map(FormView::str(...), Json::list($value) ?? []))
        <div class="{{ $radio ? 'bd-radio-group' : 'bd-checkbox-group' }}" role="{{ $radio ? 'radiogroup' : 'group' }}" id="{{ $inputId }}" {!! $aria !!}{!! $group !!}>
            @foreach ($field->options() ?? [] as $i => $option)
                <label class="{{ $radio ? 'bd-radio-option' : 'bd-checkbox-option' }}" for="{{ $inputId }}-{{ $i }}"><input class="{{ $radio ? 'bd-radio' : 'bd-checkbox' }}" type="{{ $field->type }}" id="{{ $inputId }}-{{ $i }}" value="{{ $option }}" @checked(in_array($option, $picked, true)) wire:model="{{ $model }}"><span>{{ $option }}</span></label>
            @endforeach
        </div>
        @break
    @case ('boolean')
        <label class="bd-boolean" for="{{ $inputId }}">
            <input class="bd-switch" type="checkbox" id="{{ $inputId }}" @checked($value === true) {!! $aria !!} wire:model="{{ $model }}">
            <span class="bd-boolean__label">{{ $placeholder ?? ($field->label === '' ? 'Yes' : $field->label) }}@if ($field->required || $field->mustBeTrue())<span class="bd-field__required" aria-hidden="true"> *</span>@endif</span>
        </label>
        @break
    @case ('date')
        <input class="bd-input" type="date" id="{{ $inputId }}" value="{{ $text }}" {!! $aria !!} wire:model="{{ $model }}">
        @break
    @case ('email')
        <input class="bd-input" type="email" id="{{ $inputId }}" value="{{ $text }}" placeholder="{{ $placeholder ?? 'you@example.com' }}" autocomplete="{{ $autocomplete }}" {!! $aria !!} wire:model="{{ $model }}">
        @break
    @case ('phone')
        @php($intl = $field->config('phoneConfig', 'international') === true)
        <div class="bd-phone">
            @if ($field->config('phoneConfig', 'showFlags') === true)<span class="bd-phone__flag" aria-hidden="true">🇺🇸</span>@endif
            <input class="bd-input" type="tel" id="{{ $inputId }}" value="{{ $text }}" placeholder="{{ $placeholder ?? ($intl ? '+1 (555) 000-0000' : '(555) 000-0000') }}" autocomplete="{{ $autocomplete }}" {!! $aria !!} wire:model="{{ $model }}">
        </div>
        @break
    @case ('number')
    @case ('currency')
    @case ('stepper')
        @php($decimals = $field->bool('allowDecimal') !== false && $field->type !== 'stepper')
        @php($min = Json::num($field->config('validation', 'min')))
        @php($max = Json::num($field->config('validation', 'max')))
        <input class="bd-input" type="number" id="{{ $inputId }}" value="{{ $text }}" placeholder="{{ $placeholder ?? '' }}"
            @if ($min !== null) min="{{ FormView::number($min) }}" @elseif ($field->bool('allowNegative') === false) min="0" @endif
            @if ($max !== null) max="{{ FormView::number($max) }}" @endif
            step="{{ $decimals ? 'any' : '1' }}" inputmode="{{ $decimals ? 'decimal' : 'numeric' }}" {!! $aria !!} wire:model="{{ $model }}">
        @break
    @case ('slider')
        @php($s = FormView::slider($field, $value))
        <div class="bd-slider-wrap">
            <div class="bd-slider__scale"><span>{{ ($s['fmt'])($s['lo']) }}</span><output class="bd-slider__value" for="{{ $inputId }}">{{ ($s['fmt'])($s['current']) }}</output><span>{{ ($s['fmt'])($s['hi']) }}</span></div>
            <input class="bd-slider" type="range" id="{{ $inputId }}" min="{{ FormView::number($s['lo']) }}" max="{{ FormView::number($s['hi']) }}" step="{{ FormView::number($s['step']) }}" value="{{ FormView::number($s['current']) }}" {!! $aria !!} wire:model="{{ $model }}">
        </div>
        @break
    @case ('star_rating')
        @php($most = (int) ($field->config('starRatingConfig', 'maxStars') ?? 5))
        @php($current = (int) (Json::num($value) ?? 0))
        <div class="bd-stars" role="radiogroup" id="{{ $inputId }}" {!! $aria !!}{!! $group !!}>
            @for ($i = 0; $i < $most; $i++)
                <label @class(['bd-star', 'bd-star--filled' => $i < $current])><input class="bd-visually-hidden" type="radio" value="{{ $i + 1 }}" @checked($current === $i + 1) wire:model="{{ $model }}"><span aria-hidden="true">★</span><span class="bd-visually-hidden">{{ $i + 1 }} star{{ $i === 0 ? '' : 's' }}</span></label>
            @endfor
        </div>
        @break
    @case ('happiness_rating')
        @php($current = Json::isNumber($value) ? (int) $value : -1)
        <div class="bd-happiness" role="radiogroup" id="{{ $inputId }}" {!! $aria !!}{!! $group !!}>
            @foreach (FormView::FACES as $i => [$face, $name])
                <label @class(['bd-happiness__face', 'bd-happiness__face--active' => $i === $current]) title="{{ $name }}"><input class="bd-visually-hidden" type="radio" value="{{ $i }}" @checked($current === $i) wire:model="{{ $model }}"><span aria-hidden="true">{{ $face }}</span><span class="bd-visually-hidden">{{ $name }}</span></label>
            @endforeach
        </div>
        @break
    @case ('color_picker')
        <div class="bd-colors" role="radiogroup" id="{{ $inputId }}" {!! $aria !!}{!! $group !!}>
            @foreach ($field->options() ?? [] as $color)
                <label @class(['bd-color', 'bd-color--selected' => $text === $color]) style="background-color:{{ $color }}" title="{{ $color }}"><input class="bd-visually-hidden" type="radio" value="{{ $color }}" @checked($text === $color) wire:model="{{ $model }}"><span class="bd-visually-hidden">{{ $color }}</span></label>
            @endforeach
        </div>
        @break
    @case ('choice_cards')
        @php($multi = $field->isMulti())
        @php($picked = $multi ? array_map(FormView::str(...), Json::list($value) ?? []) : [$text])
        <div class="bd-cards" role="{{ $multi ? 'group' : 'radiogroup' }}" id="{{ $inputId }}" {!! $aria !!}{!! $group !!}>
            @foreach ($field->cards() as $i => $card)
                @php($on = in_array($card->label, $picked, true))
                <label @class(['bd-card-choice', 'bd-card-choice--on' => $on]) for="{{ $inputId }}-{{ $i }}">
                    <input class="bd-card-choice__input" type="{{ $multi ? 'checkbox' : 'radio' }}" id="{{ $inputId }}-{{ $i }}" value="{{ $card->label }}" @checked($on) wire:model="{{ $model }}">
                    @isset ($card->imageUrl)<img class="bd-card-choice__image" src="{{ $card->imageUrl }}" alt="">@endisset
                    <span class="bd-card-choice__label">{{ $card->label }}</span>
                    @isset ($card->description)<span class="bd-card-choice__description">{{ $card->description }}</span>@endisset
                    @isset ($card->price)<span class="bd-card-choice__price">{{ $card->price }}</span>@endisset
                </label>
            @endforeach
        </div>
        @break
    @case ('date_range')
        @include('forms.pair', ['cells' => [['start', 'Start', 'date'], ['end', 'End', 'date']]])
        @break
    @case ('time_picker')
        @switch ($field->timeMode())
            @case ('time_block')
                @include('forms.pair', ['cells' => [['start', 'Start', 'time'], ['end', 'End', 'time']]])
                @break
            @case ('appointment')
                @include('forms.pair', ['cells' => [['date', 'Date', 'date'], ['time', 'Time', 'time']]])
                @break
            @default
                <select class="bd-select" id="{{ $inputId }}" {!! $aria !!} wire:model="{{ $model }}">
                    <option value="">{{ $placeholder ?? 'Select time' }}</option>
                    @foreach (FormView::times($field) as [$time, $label])
                        <option value="{{ $time }}" @selected($text === $time)>{{ $label }}</option>
                    @endforeach
                </select>
        @endswitch
        @break
    @case ('name')
        <div class="bd-name" role="group" id="{{ $inputId }}" {!! $group !!}>
            @foreach (FormView::nameParts($field) as [$part, $label, $token, $hint, $full])
                <label @class(['bd-name__field', 'bd-name__field--full' => $full])><span class="bd-name__label">{{ $label }}</span><input class="bd-input" id="{{ $v->id($key, $part) }}" value="{{ FormView::part($value, $part) }}" placeholder="{{ $hint }}" autocomplete="{{ $token }}" {!! $aria !!} wire:model="{{ FormView::model($key, $part) }}"></label>
            @endforeach
            @if ($field->config('nameConfig', 'nicknames') === true)
                <label class="bd-name__field bd-name__field--full"><span class="bd-name__label">Nicknames</span><input class="bd-input" value="{{ FormView::part($value, 'nicknames') }}" placeholder="Johnny, JM — separate with commas" wire:model="{{ FormView::model($key, 'nicknames') }}"></label>
            @endif
        </div>
        @break
    @case ('address')
        <div class="bd-address" role="group" id="{{ $inputId }}" {!! $group !!}>
            @foreach ([['line1', 'Address line 1', 'address-line1', true], ['line2', 'Address line 2', 'address-line2', true], ['city', 'City', 'address-level2', false], ['state', 'State', 'address-level1', false], ['zip', 'ZIP', 'postal-code', true]] as [$part, $label, $token, $full])
                <label @class(['bd-address__field', 'bd-address__field--full' => $full])><span class="bd-address__label">{{ $label }}</span><input class="bd-input" id="{{ $v->id($key, $part) }}" value="{{ FormView::part($value, $part) }}" autocomplete="{{ $token }}" {!! $aria !!} wire:model="{{ FormView::model($key, $part) }}"></label>
            @endforeach
        </div>
        @break
    @case ('url')
        <input class="bd-input" type="url" id="{{ $inputId }}" value="{{ FormView::part($value, 'url') }}" placeholder="{{ $placeholder ?? 'https://' }}" {!! $aria !!} wire:model="{{ $model }}">
        @break
    @case ('tags')
        <input class="bd-input" id="{{ $inputId }}" value="{{ implode(', ', array_map(FormView::str(...), Json::list($value) ?? [])) }}" placeholder="{{ $placeholder ?? 'Separate with commas' }}" {!! $aria !!} wire:model="{{ $model }}">
        @break
    @case ('measurement')
        @php($m = FormView::measurement($field, $value))
        <div class="bd-measurement">
            <input class="bd-input" type="number" step="any" id="{{ $inputId }}" value="{{ FormView::part($value, 'value') }}" {!! $aria !!} wire:model="{{ FormView::model($key, 'value') }}">
            @if ($m['fixed'])
                <span class="bd-measurement__unit">{{ $m['unit'] }}</span>
            @else
                <select class="bd-select" aria-label="Unit" wire:model="{{ FormView::model($key, 'unit') }}">
                    @foreach ($m['units'] as $unit)
                        <option value="{{ $unit }}" @selected($unit === $m['unit'])>{{ $unit }}</option>
                    @endforeach
                </select>
            @endif
        </div>
        @break
    @case ('calculation')
        @php($display = Json::obj($field->cfg('calculationConfig')?->display ?? null))
        @if (($display->show ?? null) !== false)
            @php($shown = Calculation::format($value, $display))
            <output class="bd-calc" id="{{ $inputId }}" aria-live="polite">{{ $shown === '' ? '—' : $shown }}</output>
        @endif
        @break
    @case ('collection_select')
        @php($cs = $v->collection($field))
        @if ($cs['message'] !== null)
            <div class="bd-field__collection" data-status="{{ $cs['status'] }}"><p class="bd-field__collection-status" role="{{ $cs['status'] === 'empty' ? 'status' : 'alert' }}">{{ $cs['message'] }}</p></div>
        @elseif ($cs['status'] === 'select')
            <div class="bd-field__collection" data-status="ready">
                <select class="bd-select bd-field__collection-select" id="{{ $inputId }}" {!! $aria !!} wire:model="{{ $model }}">
                    <option value="">{{ $placeholder ?? 'Choose…' }}</option>
                    @foreach ($cs['options'] as $option)
                        <option value="{{ $option['value'] }}" @selected($text === $option['value'])>{{ $option['label'] }}</option>
                    @endforeach
                </select>
            </div>
        @else
            @php($picked = $cs['multi'] ? array_map(FormView::str(...), Json::list($value) ?? []) : array_filter([$text]))
            <div class="bd-field__collection" data-status="ready">
                <div class="bd-field__collection-options" role="{{ $cs['multi'] ? 'group' : 'radiogroup' }}" id="{{ $inputId }}" {!! $aria !!}{!! $group !!}>
                    @foreach ($cs['options'] as $i => $option)
                        @php($on = in_array($option['value'], $picked, true))
                        <label class="bd-field__collection-option" @if ($on) data-selected="true" @endif for="{{ $inputId }}-{{ $i }}"><input type="{{ $cs['multi'] ? 'checkbox' : 'radio' }}" id="{{ $inputId }}-{{ $i }}" value="{{ $option['value'] }}" @checked($on) wire:model="{{ $model }}"><span class="bd-field__collection-label">{{ $option['label'] }}</span></label>
                    @endforeach
                </div>
            </div>
        @endif
        @break
    @case ('multi_populator')
        <div role="group" {!! $group !!}>@include('forms.repeater')</div>
        @break
    @case ('file_upload')
        @include('forms.files')
        @break
    @default
        @if (in_array($field->type, FormView::UNSUPPORTED_TYPES, true))
            <p class="bd-field__unsupported">{{ $field->label === '' ? 'This field' : $field->label }} can't be filled in on this page yet.</p>
        @else
            <input class="bd-input" type="text" id="{{ $inputId }}" value="{{ $text }}" placeholder="{{ $placeholder ?? '' }}" @if ($autocomplete) autocomplete="{{ $autocomplete }}" @endif {!! $aria !!} wire:model="{{ $model }}">
        @endif
@endswitch
