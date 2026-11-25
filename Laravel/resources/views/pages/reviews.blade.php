{{--
    The business's reviews (ReviewsController). The rating and its bars come
    from the marketing bundle; the platform filter and "Show more" are plain
    links. Writing one is <bd-review-writer> (public/shop/reviews-elements.js):
    signed out, it's a link to sign in. It's laid out from the reviews' parts
    (components/reviews/): the rating summary, the platform filter and a card
    per review.
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
        <x-reviews.rating-summary :signed-in="$signedIn" :summary="$summary" />
        <x-reviews.review-filter :source="$source" :sources="$sources" />

        @if ($reviews === [])
            <p class="reviews-empty">
                {{ $source ? 'No '.Reviews::sourceLabel($source).' reviews yet.' : "No reviews yet. Connect Google or Yelp in BusinessDash, or add reviews in the dashboard, and they'll appear here." }}
            </p>
        @else
            <ul class="review-wall">
                @foreach ($reviews as $i => $review)
                    <x-reviews.review-card :index="$i" :review="$review" />
                @endforeach
            </ul>
            @if ($moreHref)
                <p class="reviews-more"><a class="bd-btn bd-btn--ghost" href="{{ $moreHref }}">Show more reviews</a></p>
            @endif
        @endif
    @endif
@endsection
