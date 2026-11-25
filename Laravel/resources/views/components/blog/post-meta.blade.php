{{-- The author with their photo, the date and the reading time. --}}
@props(['post', 'minutes'])
<p class="post__meta">
    @if (data_get($post, 'authorAvatarUrl'))
        <img alt="" referrerpolicy="no-referrer" src="{{ data_get($post, 'authorAvatarUrl') }}">
    @endif
    @if (data_get($post, 'authorName'))<span>{{ data_get($post, 'authorName') }}</span>@endif
    <span>{{ \App\Support\PostHtml::date(data_get($post, 'publishedAt')) }}</span>
    <span>· {{ $minutes }} min read</span>
</p>
