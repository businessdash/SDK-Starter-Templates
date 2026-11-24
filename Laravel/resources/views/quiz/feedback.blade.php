{{-- A verdict: the badge, the answer given and the one accepted, and why. --}}
<div class="bd-quiz__feedback" data-field-id="{{ $f['fieldId'] }}" role="status">
    <div class="bd-quiz__feedback-row"><span class="bd-quiz__badge" data-tone="{{ $f['badge']['tone'] }}">{{ $f['badge']['label'] }}</span>@if ($f['accuracy'] !== null)<span class="bd-quiz__accuracy">{{ $f['accuracy'] }}</span>@endif</div>
    <div class="bd-quiz__answers">
        <div class="bd-quiz__answer"><p class="bd-quiz__small">{{ $f['answerLabel'] }}</p><p>{{ $f['answer'] }}</p></div>
        @if ($f['accepted'] !== null)
            <div class="bd-quiz__answer bd-quiz__answer--accepted"><p class="bd-quiz__small">{{ $f['acceptedLabel'] }}</p><p>{{ $f['accepted'] }}</p></div>
        @endif
    </div>
    @if ($f['why'] !== null)
        <div class="bd-quiz__why"><p class="bd-quiz__small">{{ $f['whyLabel'] }}</p><p>{{ $f['why'] }}</p></div>
    @endif
    @if ($f['selected'] !== [])
        <ul class="bd-quiz__explained">@foreach ($f['selected'] as $note)<li><strong>{{ $note['option'] }}</strong><span>{{ $note['explanation'] }}</span></li>@endforeach</ul>
    @endif
    @if ($f['others'] !== null)
        <details class="bd-quiz__others"><summary>{{ $f['others']['label'] }}</summary><ul class="bd-quiz__explained">@foreach ($f['others']['items'] as $note)<li><strong>{{ $note['option'] }}</strong><span>{{ $note['explanation'] }}</span></li>@endforeach</ul></details>
    @endif
</div>
