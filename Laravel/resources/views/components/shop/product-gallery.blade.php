{{--
    The photos: a set for the product, then one per option with photos of its
    own (Shop::photoSets()). <bd-gallery> shows the chosen option's set, and
    steps through it with ‹ › and the thumbnails.
--}}
@props(['productId', 'name', 'sets', 'variantId'])
@php
    $own = collect($sets)->pluck('variantId')->contains($variantId);
    $shown = $own ? $variantId : '';
@endphp
<bd-gallery data-product-id="{{ $productId }}">
    @foreach ($sets as $set)
        @php $hidden = $set['variantId'] !== $shown; @endphp
        <div class="gallery" data-bd-photos-for="{{ $set['variantId'] }}" @if ($hidden) hidden @endif>
            <div class="gallery__main">
                @if ($set['photos'][0] ?? null)
                    <img alt="{{ $name }}" data-bd-main @if ($hidden) loading="lazy" @endif referrerpolicy="no-referrer" src="{{ $set['photos'][0] }}">
                @else
                    <div class="gallery__placeholder">No photo yet</div>
                @endif
                @if (count($set['photos']) > 1)
                    <button aria-label="Previous photo" class="gallery__step gallery__step--prev" data-bd-step="-1" type="button">‹</button>
                    <button aria-label="Next photo" class="gallery__step gallery__step--next" data-bd-step="1" type="button">›</button>
                @endif
            </div>
            @if (count($set['photos']) > 1)
                <div class="gallery__thumbs">
                    @foreach ($set['photos'] as $i => $src)
                        <button aria-current="{{ $i === 0 ? 'true' : 'false' }}" aria-label="Photo {{ $i + 1 }} of {{ count($set['photos']) }}" @class(['gallery__thumb', 'gallery__thumb--on' => $i === 0]) data-bd-photo="{{ $i }}" type="button"><img alt="" loading="lazy" referrerpolicy="no-referrer" src="{{ $src }}"></button>
                    @endforeach
                </div>
            @endif
        </div>
    @endforeach
</bd-gallery>
