{{-- "Complete your purchase": add-ons, each with Add (<bd-addon> posts it to `addUrl`). --}}
@props(['addons', 'addUrl'])
@if ($addons)
    <section class="product-section">
        <h2 class="product-section__title">Complete your purchase</h2>
        <div class="addon-grid">
            @foreach ($addons as $addon)
                <div class="addon-card bd-card">
                    <div class="addon-card__media">
                        @if (data_get($addon, 'imageUrl'))
                            <img alt="{{ data_get($addon, 'addonName') }}" loading="lazy" referrerpolicy="no-referrer" src="{{ data_get($addon, 'imageUrl') }}">
                        @else
                            <div class="addon-card__noimg">—</div>
                        @endif
                    </div>
                    <div class="addon-card__body">
                        @if (data_get($addon, 'groupLabel'))<span class="addon-card__group">{{ data_get($addon, 'groupLabel') }}</span>@endif
                        <p class="addon-card__name">{{ data_get($addon, 'addonName') }}</p>
                        @if (data_get($addon, 'priceCents') !== null)<span class="addon-card__price">{{ \App\Support\Money::cents(data_get($addon, 'priceCents')) }}</span>@endif
                    </div>
                    @php $variant = \App\Support\Shop::addonVariant($addon); @endphp
                    <bd-addon data-add-url="{{ $addUrl }}" data-product-id="{{ data_get($addon, 'addonProductId') }}" @if ($variant) data-variant-id="{{ $variant }}" @endif>
                        <button class="bd-btn bd-btn--ghost addon-card__add" data-bd-add type="button">Add</button>
                    </bd-addon>
                </div>
            @endforeach
        </div>
    </section>
@endif
