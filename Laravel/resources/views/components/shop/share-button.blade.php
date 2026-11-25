{{-- ↗ Share: the share sheet, or the link copied ("Link copied"). --}}
@props(['title'])
<bd-share data-title="{{ $title }}">
    <button class="share" data-bd-share type="button"><span aria-hidden="true">↗</span> Share</button>
    <span class="share__note" data-bd-share-note hidden role="status"></span>
</bd-share>
