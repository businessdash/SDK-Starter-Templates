{{--
    A BusinessDash quiz (App\Livewire\BdQuiz), in the SDK's bd-quiz__* markup
    and classes, so public/forms.css styles it as it styles the SDK's quiz.

    An answer reaches the server when it changes (a choice picked, a box
    left); buttons run the screen's actions; a running clock re-reads itself
    once a second (wire:poll) and submits the quiz at zero.
--}}
<div class="bd-quiz-host">
    @if ($screen === null)
        <div class="bd-quiz">
            @include('quiz.header')
            @if ($status !== null)
                <div class="bd-quiz__status"><p>{{ $status }}</p><div class="bd-quiz__actions"><a class="bd-quiz__button" href="{{ $this->path() }}">Try again</a></div></div>
            @elseif ($gate !== null)
                <div class="bd-quiz__gate" data-kind="{{ $gate['kind'] }}">
                    @if ($gate['title'] !== null)<h3>{{ $gate['title'] }}</h3>@endif
                    <p>{{ $gate['body'] }}</p>
                    @if (($gate['action']['href'] ?? null) !== null)
                        <div class="bd-quiz__actions"><a class="bd-quiz__button bd-quiz__button--primary" href="{{ $gate['action']['href'] }}">{{ $gate['action']['label'] ?? 'Continue' }}</a></div>
                    @endif
                </div>
            @endif
        </div>
    @else
        @php($s = $screen)
        <form class="bd-quiz" id="bd-quiz-{{ $run }}" data-phase="{{ $s['phase'] }}" @if ($s['busy']) aria-busy="true" @endif novalidate
            wire:submit="act('primary')" wire:loading.class="bd-quiz--busy" wire:target="act">
            @include('quiz.header')
            @switch ($s['phase'])
                @case ('empty')
                    <p class="bd-quiz__status">{{ $s['empty'] ?? '' }}</p>
                    @break
                @case ('ready')
                    <div class="bd-quiz__ready" data-icon="{{ $s['ready']['icon'] }}">
                        <h3>{{ $s['ready']['title'] }}</h3>
                        <p>{{ $s['ready']['body'] }}</p>
                        @include('quiz.actions')
                        @include('quiz.error')
                    </div>
                    @break
                @case ('done')
                    @php($done = $s['done'])
                    @if ($done['kind'] === 'results')
                        <section class="bd-quiz__results" @if ($done['passed'] === true) data-passed @endif>
                            <p class="bd-quiz__eyebrow">{{ $done['eyebrow'] }}</p>
                            <p class="bd-quiz__score">{{ $done['score'] }}</p>
                            @if ($done['tally'] !== null)<p class="bd-quiz__tally">{{ $done['tally'] }}</p>@endif
                            <p class="bd-quiz__summary">{{ $done['summary'] }}</p>
                            @if ($done['message'] !== null)<p class="bd-quiz__message">{{ $done['message'] }}</p>@endif
                            @if ($done['timing'] !== null)<p class="bd-quiz__timing">{{ $done['timing'] }}</p>@endif
                        </section>
                        <ol class="bd-quiz__review">
                            @foreach ($done['items'] as $item)
                                <li data-tone="{{ $item['tone'] }}" wire:key="review-{{ $item['number'] }}">
                                    <details class="bd-quiz__review-item">
                                        <summary class="bd-quiz__review-label"><span class="bd-quiz__number">{{ $item['number'] }}.</span>{{ $item['label'] }}<span class="bd-quiz__badge" data-tone="{{ $item['feedback']['badge']['tone'] }}">{{ $item['feedback']['badge']['label'] }}</span></summary>
                                        @include('quiz.feedback', ['f' => $item['feedback']])
                                    </details>
                                </li>
                            @endforeach
                        </ol>
                        @include('quiz.actions')
                    @else
                        <div class="bd-quiz__done" data-kind="{{ $done['kind'] }}">
                            <p class="bd-quiz__eyebrow">{{ $done['eyebrow'] }}</p>
                            <h3>{{ $done['title'] }}</h3>
                            <p>{{ $done['body'] }}</p>
                            @include('quiz.actions')
                        </div>
                    @endif
                    @break
                @default
                    @if ($s['timer'] !== null)
                        @php($t = $s['timer'])
                        {{-- The clock: re-read once a second while it runs, and after time's up until the quiz has sent. --}}
                        <div class="bd-quiz__timer" id="bd-quiz-timer-{{ $run }}" @if ($t['warning']) data-warning @endif @if ($t['paused']) data-paused @endif role="timer" @if ($polling) wire:poll.1s="tick" @endif>
                            <span class="bd-quiz__timer-label">{{ $t['label'] }}@if ($t['paused'])<span class="bd-quiz__paused">{{ $t['pausedLabel'] }}</span>@endif</span>
                            <span class="bd-quiz__timer-value">{{ $t['value'] }}</span>
                            @if ($t['progress'] !== null)<span class="bd-quiz__timer-bar" style="width:{{ \App\Bd\Forms\FormView::number(round($t['progress'] * 10) / 10) }}%"></span>@endif
                        </div>
                    @endif
                    @if ($s['progress'] !== null)
                        <div class="bd-quiz__progress">
                            <div class="bd-quiz__progress-row"><span>{{ $s['progress']['position'] }}</span>@if ($s['progress']['note'] !== null)<span>{{ $s['progress']['note'] }}</span>@endif</div>
                            <div class="bd-quiz__progress-bar" aria-hidden="true"><span style="width:{{ \App\Bd\Forms\FormView::number(round($s['progress']['percent'] * 10) / 10) }}%"></span></div>
                        </div>
                    @endif
                    @if ($s['notice'] !== null)<p class="bd-quiz__notice">{{ $s['notice'] }}</p>@endif
                    @foreach ($s['questions'] as $q)
                        @include('quiz.question')
                    @endforeach
                    @if ($s['feedback'] !== null)
                        @include('quiz.feedback', ['f' => $s['feedback']])
                    @endif
                    @include('quiz.error')
                    @include('quiz.actions')
            @endswitch
        </form>
    @endif
</div>
