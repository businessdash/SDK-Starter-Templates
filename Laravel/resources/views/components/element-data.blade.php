{{--
    Server data for a shop or blog element, as JSON in a script tag inside it.
    JSON_HEX_TAG writes < and > as < and >, so the JSON can't close
    the tag early.
--}}
@props(['value'])
<script type="application/json">{!! json_encode($value, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) !!}</script>
