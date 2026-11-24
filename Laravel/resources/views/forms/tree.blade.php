{{--
    A list of fields (App\Livewire\BdForm). $prefix is the repeater row's key
    prefix ('' at the top), $entries its [repeater id, row] path, $flat says
    whether groups draw flat (inside a step or a row) or as cards.
--}}
<div class="bd-tree">
    @foreach ($fields as $field)
        @switch ($field->type)
            @case ('input_group')
                @php($kids = $field->children ?? [])
                @php($count = $v->c->revealCount($field, $entries))
                <div @class(['bd-group', 'bd-group--flat' => $flat, 'bd-group--card' => ! $flat]) data-bd-group="{{ \App\Bd\Forms\FormView::cssKey($field) }}" @if (! $v->c->isVisible($field, $entries)) hidden @endif wire:key="group-{{ $prefix }}{{ $field->id }}">
                    @if ($field->bool('showGroupLabel') === true && $field->label !== '')
                        <div class="bd-group__label">{{ $field->label }}</div>
                    @endif
                    @include('forms.tree', ['fields' => array_slice($kids, 0, $count)])
                    @if ($count < count($kids))
                        <div hidden>@include('forms.tree', ['fields' => array_slice($kids, $count)])</div>
                    @endif
                </div>
                @break
            @case ('condition_block')
                {{-- Hidden, not dropped: what's typed there comes back if the condition does. --}}
                <div class="bd-condition" @if (! $v->c->isVisible($field, $entries)) hidden @endif wire:key="condition-{{ $prefix }}{{ $field->id }}">
                    @include('forms.tree', ['fields' => $field->children ?? []])
                </div>
                @break
            @case ('or_condition')
                @php($kids = $field->children ?? [])
                @php($orError = $v->errors[(new \App\Bd\Forms\FieldPath($field->id, $entries))->key()] ?? null)
                <div @class(['bd-or', 'bd-or--error' => $orError !== null]) wire:key="or-{{ $prefix }}{{ $field->id }}">
                    @if ($field->label !== '')
                        <div class="bd-or__label">{{ $field->label }}<span class="bd-or__hint"> Fill at least one side</span></div>
                    @endif
                    <div class="bd-or__grid">
                        <div class="bd-or__side"><div class="bd-or__side-label">{{ $field->config('orConditionConfig', 'leftLabel') ?? 'Option A' }}</div>@isset ($kids[0]) @include('forms.tree', ['fields' => [$kids[0]]]) @endisset</div>
                        <div class="bd-or__divider"><span class="bd-or__badge">OR</span></div>
                        <div class="bd-or__side"><div class="bd-or__side-label">{{ $field->config('orConditionConfig', 'rightLabel') ?? 'Option B' }}</div>@isset ($kids[1]) @include('forms.tree', ['fields' => [$kids[1]]]) @endisset</div>
                    </div>
                    @if ($orError !== null)
                        <p class="bd-or__error">{{ $orError }}</p>
                    @endif
                </div>
                @break
            @case ('flex_row')
                <div class="bd-flex-row" wire:key="row-{{ $prefix }}{{ $field->id }}">
                    @foreach ($field->children ?? [] as $cell)
                        <div class="bd-flex-row__cell">@include('forms.tree', ['fields' => [$cell]])</div>
                    @endforeach
                </div>
                @break
            @case ('reference_value')
                @break
            @default
                @include('forms.field')
        @endswitch
    @endforeach
</div>
