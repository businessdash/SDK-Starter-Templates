{{-- ♡ Like with the count. Signed out, it leads to sign-in and back. It's <bd-post-like> (public/shop/blog-elements.js). --}}
@props(['likes', 'likeUrl', 'signInHref'])
<bd-post-like data-like-url="{{ $likeUrl }}" data-sign-in-href="{{ $signInHref }}">
    <x-element-data :value="$likes" />
</bd-post-like>
