{{-- A post in the list: cover, Pinned, date, reading time, title, excerpt and author. `lead` draws it large. --}}
@props(['post', 'lead' => false])
<li @class(['bd-card', 'post-card', 'post-card--lead' => $lead])>
    <a class="post-card__link" href="{{ route('blog.show', data_get($post, 'slug')) }}">
        @if (data_get($post, 'imageUrl'))
            <img alt="" class="post-card__img" loading="lazy" referrerpolicy="no-referrer" src="{{ data_get($post, 'imageUrl') }}">
        @endif
        <div class="post-card__body">
            <p class="post-card__meta">
                @if (data_get($post, 'isPinned'))<span class="bd-badge">Pinned</span>@endif
                <span>{{ \App\Support\PostHtml::date(data_get($post, 'publishedAt')) }}</span>
                <span>· {{ \App\Support\PostHtml::readingMinutes((string) (data_get($post, 'content') ?: data_get($post, 'excerpt', ''))) }} min read</span>
            </p>
            <h2>{{ data_get($post, 'title') }}</h2>
            @if (data_get($post, 'excerpt'))
                <p class="post-card__excerpt">{{ data_get($post, 'excerpt') }}</p>
            @endif
            @if (data_get($post, 'authorName'))
                <p class="post-card__author">{{ data_get($post, 'authorName') }}</p>
            @endif
        </div>
    </a>
</li>
