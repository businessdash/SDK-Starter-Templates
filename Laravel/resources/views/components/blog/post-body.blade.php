{{-- The post. `html` must come from PostHtml::safe, which rebuilds it from an allowlist. --}}
@props(['html'])
<div class="post__body">{!! $html !!}</div>
