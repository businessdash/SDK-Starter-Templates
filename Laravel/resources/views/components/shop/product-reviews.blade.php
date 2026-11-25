{{-- The product's reviews: the average, each review, and Show more reviews (`moreHref`). --}}
@props(['reviews' => null, 'moreHref' => null])
@php $items = data_get($reviews, 'items', []) ?: []; $avg = (float) data_get($reviews, 'avgRating', 0); @endphp
<section class="product-section" id="reviews">
    <h2 class="product-section__title">Reviews</h2>
    @if ($items)
        <p class="reviews__summary"><x-stars :rating="$avg" /><strong>{{ number_format($avg, 1) }} out of 5</strong><span>from {{ data_get($reviews, 'totalCount', 0) }} reviews</span></p>
        <div class="review-list">
            @foreach ($items as $review)
                @php $body = data_get($review, 'content') ?: data_get($review, 'body'); @endphp
                <article class="review">
                    <div class="review__head"><x-stars :rating="(float) data_get($review, 'rating', 0)" /><span class="review__name">{{ data_get($review, 'reviewerName') ?: 'Verified buyer' }}</span><span class="review__date">{{ \App\Support\Shop::reviewDate(data_get($review, 'createdAt')) }}</span></div>
                    @if (data_get($review, 'title'))<p class="review__title">{{ data_get($review, 'title') }}</p>@endif
                    @if ($body)<p class="review__body">{{ $body }}</p>@endif
                </article>
            @endforeach
        </div>
        @if ($moreHref)
            <a class="bd-btn bd-btn--ghost reviews__more" href="{{ $moreHref }}">Show more reviews</a>
        @endif
    @else
        <p class="reviews__none">No reviews yet.</p>
    @endif
</section>
