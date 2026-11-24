{{--
    A file field: what's picked so far and a picker for more. A picked file
    uploads to Livewire's temporary storage at once and waits there until
    Submit sends it to BD.
--}}
@php
    use App\Bd\Forms\FormView;
    use App\Bd\Forms\Json;

    $list = Json::list($value) ?? [];
    $most = (int) ($field->config('fileConfig', 'maxFiles') ?? 1);
    $allowed = Json::strings($field->config('fileConfig', 'allowedTypes'));
    $remaining = max($most - count($list), 0);
    $slot = 'uploads.'.FormView::uploadSlot($path->key());
    // A new picker each time the list changes, so a file already held isn't picked twice.
    $pickerId = $inputId.'-'.count($list);
@endphp
<div class="bd-file" role="group" id="{{ $inputId }}" {!! $group !!}>
    @if ($remaining > 0)
        <label class="bd-file__trigger" for="{{ $pickerId }}" wire:key="picker-{{ $pickerId }}">
            <span id="{{ $pickerId }}-text">{{ $list === [] ? 'Choose a file' : 'Add another' }}{{ $most > 1 ? " (up to {$remaining} more)" : '' }}</span>
            <span class="bd-file__uploading" wire:loading wire:target="{{ $slot }}"> · uploading…</span>
            <input class="bd-file__input" type="file" id="{{ $pickerId }}" @if ($remaining > 1) multiple @endif @if ($allowed !== []) accept="{{ implode(',', $allowed) }}" @endif {!! $aria !!} @if ($labelledBy) aria-labelledby="{{ $labelledBy }} {{ $pickerId }}-text" @endif wire:model="{{ $slot }}">
        </label>
    @else
        <p class="bd-field__help">That's the most files this takes ({{ $most }}).</p>
    @endif
    @if ($list !== [])
        <ul class="bd-file__list">
            @foreach ($list as $i => $file)
                @php($fileName = Json::str(Json::get($file, 'name')) ?? 'file')
                <li class="bd-file__item" wire:key="file-{{ $key }}-{{ $i }}"><span class="bd-file__name">{{ $fileName }}</span><span class="bd-file__size">{{ FormView::kilobytes($file) }} KB{{ Json::get($file, 'pending') === true ? ' · sends with the form' : '' }}</span><button class="bd-file__remove" type="button" wire:click="removeFile(@js($field->id), @js($entries), {{ $i }})" aria-label="Remove {{ $fileName }}">✕</button></li>
            @endforeach
        </ul>
    @endif
</div>
