@extends('layout')
@section('title', 'Reviews')
@section('content')
    <h1>Reviews</h1>
    @forelse ($reviews as $review)
        <blockquote>
            <p>{{ data_get($review, 'text') }}</p>
            <cite>{{ data_get($review, 'reviewerName', 'Anonymous') }} — {{ data_get($review, 'rating') }}/5</cite>
        </blockquote>
    @empty
        <p class="muted">No reviews yet.</p>
    @endforelse

    @if ($reviews)
        <a href="{{ route('reviews', ['offset' => $offset + 10]) }}">Load more →</a>
    @endif
@endsection
