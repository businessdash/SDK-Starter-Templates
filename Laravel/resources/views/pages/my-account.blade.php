@extends('layout')
@section('title', 'My account')
@section('content')
    <h1>My account</h1>
    <p>Signed in as {{ data_get($user, 'email', 'a customer') }}.</p>
    <a href="/api/bd-auth/sign-out">Sign out</a>

    @if (session('review_status'))
        <p class="notice">{{ session('review_status') }}</p>
    @endif

    <section>
        <h2>Your work</h2>
        @php($jobs = data_get($work, 'jobs', []))
        @forelse ($jobs as $job)
            @if ($loop->first)<ul>@endif
            <li>{{ data_get($job, 'name') }} — {{ data_get($job, 'status') }}</li>
            @if ($loop->last)</ul>@endif
        @empty
            <p class="muted">Nothing here yet.</p>
        @endforelse
    </section>

    <section>
        <h2>Leave a review</h2>
        <form method="POST" action="{{ route('portal.review') }}">
            @csrf
            <label>Rating
                <select name="rating">
                    @for ($i = 5; $i >= 1; $i--)
                        <option value="{{ $i }}">{{ $i }}</option>
                    @endfor
                </select>
            </label>
            <textarea name="body" required placeholder="How did we do?"></textarea>
            <button type="submit">Submit</button>
        </form>
    </section>
@endsection
