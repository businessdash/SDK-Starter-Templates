@if ($header !== null)
    <header class="bd-quiz__header">
        <p class="bd-quiz__eyebrow">{{ $header['eyebrow'] }}</p>
        <h2 class="bd-quiz__title">{{ $header['title'] }}</h2>
        @if ($header['description'] !== null)<p class="bd-quiz__description">{{ $header['description'] }}</p>@endif
        @if ($header['facts'] !== [])
            <ul class="bd-quiz__facts">@foreach ($header['facts'] as $fact)<li>{{ $fact }}</li>@endforeach</ul>
        @endif
    </header>
@endif
