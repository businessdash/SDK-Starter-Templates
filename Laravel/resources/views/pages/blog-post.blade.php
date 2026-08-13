@extends('layout')
@section('title', data_get($post, 'title', 'Post'))
@section('content')
    <article>
        <h1>{{ data_get($post, 'title') }}</h1>
        {{-- Post bodies are authored HTML from the dashboard. --}}
        <div class="post-body">{!! data_get($post, 'content', '') !!}
    @if (($access ?? 'granted') === 'paywall')
        <p class="muted">This is a preview — the full article is behind the paywall.</p>
    @endif</div>
    </article>

    @if ($comments)
        <section>
            <h2>Comments</h2>
            @foreach ($comments as $comment)
                <div class="comment">
                    <strong>{{ data_get($comment, 'authorName', 'Anonymous') }}</strong>
                    <p>{{ data_get($comment, 'content') }}</p>
                </div>
            @endforeach
        </section>
    @endif
@endsection
