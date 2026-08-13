@extends('layout')
@section('title', 'Blog')
@section('content')
    <h1>Blog</h1>
    @forelse ($posts as $post)
        @if ($loop->first)<ul class="post-list">@endif
        <li>
            <a href="{{ route('blog.show', data_get($post, 'slug')) }}">{{ data_get($post, 'title') }}</a>
            <p class="muted">{{ data_get($post, 'excerpt') }}</p>
        </li>
        @if ($loop->last)</ul>@endif
    @empty
        <p class="muted">No posts yet.</p>
    @endforelse
@endsection
