{{--
    One option group (Size, Colour…): a button per value. Groups that belong
    to another variant start hidden; <bd-product-form> shows the chosen
    variant's and names the chosen value beside the title.
--}}
@props(['group', 'hidden' => false])
<fieldset class="choice" @if ($group['variantId'] !== null) data-bd-for-variant="{{ $group['variantId'] }}" @endif data-bd-group="{{ $group['id'] }}" @if ($hidden) hidden @endif>
    <legend class="bd-label">{{ $group['title'] }}<span class="choice__picked" data-bd-picked hidden></span></legend>
    <div class="choice__values">
        @foreach ($group['values'] as $value)
            <button aria-pressed="false" class="choice__value" data-bd-value="{{ $value['id'] }}" @disabled(! $value['available']) @if (! $value['available']) title="Sold out" @endif type="button">{{ $value['value'] }}</button>
        @endforeach
    </div>
</fieldset>
