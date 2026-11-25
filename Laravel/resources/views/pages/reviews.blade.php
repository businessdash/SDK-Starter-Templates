{{--
    The business's reviews (ReviewsController). The rating and its bars come
    from the marketing bundle; the platform filter and "Show more" are plain
    links. Writing one is <bd-review-writer> (public/shop/reviews-elements.js):
    signed out, it's a link to sign in.
--}}
@php use App\Support\Reviews; @endphp
@extends('layout')
@section('title', 'Reviews')
@push('head')
    <link rel="stylesheet" href="/bd-pages.css">
    <link rel="stylesheet" href="/bd-reviews.css">
@endpush
@push('scripts')
    <script type="module" src="/shop/reviews-elements.js"></script>
@endpush
@section('main_class', 'bd-page')
@section('content')
    <div class="bd-section__lead">
        <span class="bd-section__eyebrow">Reviews</span>
        <h1 class="bd-section__title">What customers say</h1>
    </div>

    @if (! $configured)
        <div class="bd-empty">Reviews aren't connected yet. Set BD_API_KEY and BD_SITE_ID, and your rating and reviews appear here.</div>
    @else
        <section class="reviews-summary" aria-label="{{ $summary['average'] !== null ? 'Rating' : 'Write a review' }}">
            @if ($summary['average'] !== null)
                <div class="reviews-summary__score">
                    <span class="reviews-summary__average">{{ number_format($summary['average'], 1) }}</span>
                    <span class="review-stars" role="img" aria-label="{{ number_format($summary['average'], 1) }} out of 5">{{ Reviews::stars($summary['average']) }}</span>
                    <span class="reviews-summary__count">{{ $summary['total'] }} {{ $summary['total'] === 1 ? 'review' : 'reviews' }}</span>
                </div>
                <ul class="reviews-bars">
                    @foreach ($summary['histogram'] as $row)
                        <li aria-label="{{ $row['stars'] }} stars: {{ $row['count'] }}">
                            <span>{{ $row['stars'] }} ★</span>
                            <span class="reviews-bars__track"><span class="reviews-bars__fill" style="width: {{ round($row['share'] * 100) }}%"></span></span>
                            <span>{{ $row['count'] }}</span>
                        </li>
                    @endforeach
                </ul>
            @endif
            <div class="reviews-summary__write">
                <bd-review-writer data-write-url="{{ route('reviews.write', [], false) }}" data-sign-in-href="/my-account?next={{ urlencode('/reviews') }}">
                    <x-element-data :value="['signedIn' => $signedIn]" />
                </bd-review-writer>
            </div>
        </section>

        @if (count($sources) > 1)
            <nav aria-label="Platform">
                <ul class="reviews-filter">
                    <li><a href="{{ route('reviews', [], false) }}" aria-current="{{ $source === null ? 'true' : 'false' }}">All</a></li>
                    @foreach ($sources as $s)
                        <li><a href="{{ route('reviews', ['source' => $s], false) }}" aria-current="{{ $source === $s ? 'true' : 'false' }}">{{ Reviews::sourceLabel($s) }}</a></li>
                    @endforeach
                </ul>
            </nav>
        @endif

        @if ($reviews === [])
            <p class="reviews-empty">
                {{ $source ? 'No '.Reviews::sourceLabel($source).' reviews yet.' : "No reviews yet. Connect Google or Yelp in BusinessDash, or add reviews in the dashboard, and they'll appear here." }}
            </p>
        @else
            <ul class="review-wall">
                @foreach ($reviews as $i => $review)
                    @php
                        $avatar = Reviews::webUrl($review['reviewerImageUrl'] ?? null);
                        $platform = Reviews::platformName($review['source'] ?? null);
                        $link = Reviews::link($review);
                        $photos = array_values(array_filter(array_map([Reviews::class, 'webUrl'], (array) ($review['photos'] ?? []))));
                        $verified = ($review['verified'] ?? false) === true;
                    @endphp
                    <li class="review-card" id="review-{{ $i }}">
                        <div class="review-card__head">
                            @if ($avatar)
                                <img class="review-card__avatar" src="{{ $avatar }}" alt="" loading="lazy">
                            @else
                                <span class="review-card__avatar" aria-hidden="true">{{ Reviews::initial($review) }}</span>
                            @endif
                            <div>
                                <p class="review-card__name">{{ Reviews::reviewerName($review) }}</p>
                                <p class="review-card__meta"><span class="review-stars" role="img" aria-label="{{ $review['rating'] ?? 0 }} out of 5">{{ Reviews::stars($review['rating'] ?? 0) }}</span> · {{ Reviews::date($review['timeCreated'] ?? null) }}</p>
                            </div>
                        </div>
                        <p class="review-card__text">{{ $review['text'] ?? '' }}</p>
                        @if ($photos !== [])
                            <ul class="review-card__photos" aria-label="Photos from the reviewer">
                                @foreach ($photos as $photo)
                                    <li><img src="{{ $photo }}" alt="" loading="lazy"></li>
                                @endforeach
                            </ul>
                        @endif
                        @if ($platform || $verified)
                            <p class="review-card__foot">
                                @if ($platform)<span class="review-card__platform">{{ $platform }}</span>@endif
                                @if ($verified)<span class="review-card__verified">✓ Verified</span>@endif
                                @if ($link && $platform)<a class="review-card__link" href="{{ $link }}" target="_blank" rel="noopener noreferrer">Read on {{ $platform }}</a>@endif
                            </p>
                        @endif
                    </li>
                @endforeach
            </ul>
            @if ($moreHref)
                <p class="reviews-more"><a class="bd-btn bd-btn--ghost" href="{{ $moreHref }}">Show more reviews</a></p>
            @endif
        @endif
    @endif
@endsection
