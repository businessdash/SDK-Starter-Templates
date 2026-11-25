{{-- One review: photo or initial, name, stars, date, text, photos, and where it came from. --}}
@props(['review', 'index' => 0])
@use('App\Support\Reviews')
@php
    $avatar = Reviews::webUrl($review['reviewerImageUrl'] ?? null);
    $platform = Reviews::platformName($review['source'] ?? null);
    $link = Reviews::link($review);
    $photos = array_values(array_filter(array_map([Reviews::class, 'webUrl'], (array) ($review['photos'] ?? []))));
    $verified = ($review['verified'] ?? false) === true;
@endphp
<li class="review-card" id="review-{{ $index }}">
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
