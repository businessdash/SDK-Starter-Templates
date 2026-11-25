{{-- The post's tags, each a link to the posts with it. --}}
@props(['tags' => []])
@if ($tags)
    <ul class="post__tags">
        @foreach ($tags as $tag)
            <li><a href="{{ route('blog').'?tag='.rawurlencode($tag) }}">#{{ $tag }}</a></li>
        @endforeach
    </ul>
@endif
