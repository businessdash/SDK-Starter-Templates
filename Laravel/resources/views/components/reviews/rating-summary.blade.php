{{--
    The average with its stars and the number of reviews, a bar per star, and
    "Write a review" (<bd-review-writer>, public/shop/reviews-elements.js,
    which posts to /reviews/write; signed out, it's a link to sign in).
    Before there are any reviews, just the writer.
--}}
@props(['summary', 'signedIn' => false])
@use('App\Support\Reviews')
<section class="reviews-summary" aria-label="{{ $summary['average'] !== null ? 'Rating' : 'Write a review' }}">
    @if ($summary['average'] !== null)
        <div class="reviews-summary__score">
            <span class="reviews-summary__average">{{ number_format($summary['average'], 1) }}</span>
            <span class="review-stars" role="img" aria-label="{{ number_format($summary['average'], 1) }} out of 5">{{ Reviews::stars($summary['average']) }}</span>
            <span class="reviews-summary__count">{{ $summary['total'] }} {{ $summary['total'] === 1 ? 'review' : 'reviews' }}</span>
        </div>
        <ul class="reviews-bars">
            @foreach ($summary['histogram'] as $row)
                <li aria-label="{{ $row['stars'] }} {{ $row['stars'] === 1 ? 'star' : 'stars' }}: {{ $row['count'] }}">
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
