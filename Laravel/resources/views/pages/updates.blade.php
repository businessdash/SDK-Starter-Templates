@extends('layout')
@section('title', 'Updates')
@section('content')
    <h1>Updates</h1>
    @forelse ($updates as $update)
        <article class="update">
            <h2>{{ data_get($update, 'title') }}</h2>
            <p>{{ data_get($update, 'body') }}</p>
        </article>
    @empty
        <p class="muted">Nothing posted yet.</p>
    @endforelse
@endsection
