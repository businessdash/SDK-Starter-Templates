{{--
    A button per variant (Cloud, Storm…), the chosen one pressed; sold-out
    ones can't be pressed. Nothing shows for a product with one variant. A
    variant's price shows on its button while it has no options of its own.
--}}
@props(['variants', 'selected', 'showPrices'])
@if (count($variants) > 1)
    <fieldset class="choice">
        <legend class="bd-label">Option</legend>
        <div class="choice__values">
            @foreach ($variants as $v)
                <button aria-pressed="{{ $v['id'] === $selected ? 'true' : 'false' }}" @class(['choice__value', 'choice__value--on' => $v['id'] === $selected]) data-bd-variant="{{ $v['id'] }}" @disabled(! $v['available']) type="button">{{ $v['name'] }}@if ($v['price'] !== null)<small data-bd-variant-price @if (! $showPrices) hidden @endif> {{ \App\Support\Money::amount($v['price']) }}</small>@endif</button>
            @endforeach
        </div>
    </fieldset>
@endif
