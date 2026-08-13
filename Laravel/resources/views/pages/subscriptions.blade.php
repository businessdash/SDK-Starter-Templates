@extends('layout')
@section('title', 'Plans')
@section('content')
    <h1>Plans</h1>
    @forelse ($plans as $plan)
        @if ($loop->first)<ul class="grid">@endif
        <li class="card">
            <h2>{{ data_get($plan, 'name') }}</h2>
            <p class="price">{{ \App\Support\Money::cents(data_get($plan, 'amountCents')) }}</p>
            <form method="POST" action="{{ route('subscriptions.checkout', data_get($plan, 'id')) }}">
                @csrf
                <button type="submit">Subscribe</button>
            </form>
        </li>
        @if ($loop->last)</ul>@endif
    @empty
        <p class="muted">No plans published yet.</p>
    @endforelse
@endsection
