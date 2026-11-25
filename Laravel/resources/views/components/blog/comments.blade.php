{{--
    The comments and, signed in, a box to add one; signed out, a link to sign
    in and back. It's <bd-post-comments> (public/shop/blog-elements.js).
--}}
@props(['comments', 'commentUrl', 'signInHref'])
<bd-post-comments data-comment-url="{{ $commentUrl }}" data-sign-in-href="{{ $signInHref }}">
    <x-element-data :value="$comments" />
</bd-post-comments>
