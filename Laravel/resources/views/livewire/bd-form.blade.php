{{--
    A BusinessDash form (App\Livewire\BdForm), in the SDK's bd-* markup and
    classes, so the SDK's bd-forms.css and public/forms.css style it as they
    style the <bd-form> element.

    Boxes bind with `wire:model`, so typing stays in the page; the form sends
    them whenever one changes ("change": a box left after typing, a choice
    picked) and re-renders. The primary button (and Enter in a box) is Next
    on a step, else Submit.
--}}
<div class="bd-form-host">
    @if ($v === null)
        <div class="bd-form" data-bd-status="error"><div class="bd-form__error" role="alert">{{ $unavailable ?? 'Could not load this form.' }}</div></div>
    @elseif ($v->c->isSubmitted())
        <div class="bd-form" id="bd-form-{{ $v->formId }}" data-bd-status="submitted">
            <div class="bd-form__success" role="status">
                <p class="bd-form__success-title">Thanks — we got it.</p>
                @if ($v->sample)
                    <p class="bd-form__success-note">This is the bundled sample, so nothing was sent.</p>
                @endif
                <button class="bd-btn bd-btn--ghost" type="button" wire:click="again">Fill it in again</button>
            </div>
        </div>
    @else
        @php
            $c = $v->c;
            $stepped = $v->stepped();
            $labels = $v->summaryLabels();
            $title = $c->schema->title;
            $description = $c->schema->description;
            $prefix = '';
            $entries = [];
        @endphp
        <form class="bd-form" id="bd-form-{{ $v->formId }}" data-bd-status="idle" novalidate
            wire:submit="enter" x-on:change="$wire.$commit()"
            wire:loading.class="bd-form--sending" wire:target="enter">
            @if ($c->schema->orgIcon)
                <img class="bd-form__org-icon" src="{{ $c->schema->orgIcon }}" alt="">
            @endif
            @if (($title ?? '') !== '' || ($description ?? '') !== '')
                <div class="bd-form__header">
                    @if (($title ?? '') !== '')<h2 class="bd-form__title">{{ $title }}</h2>@endif
                    @if (($description ?? '') !== '')<p class="bd-form__description">{{ $description }}</p>@endif
                </div>
            @endif

            @if ($stepped && $v->showsProgress())
                @if ($v->progressBar())
                    <div class="bd-progress bd-progress--bar">
                        <span class="bd-progress__count">{{ $c->currentStep() + 1 }} / {{ $c->stepCount() }}</span>
                        <div class="bd-progress__track"><div class="bd-progress__fill" style="width:{{ (int) round($c->progress() * 100) }}%"></div></div>
                    </div>
                @else
                    <div class="bd-progress bd-progress--steps"><div class="bd-progress__steps">
                        @for ($i = 0; $i < $c->stepCount(); $i++)
                            @if ($i > 0)
                                <div @class(['bd-progress__line', 'bd-progress__line--done' => $i <= $c->currentStep()])></div>
                            @endif
                            <button @class(['bd-progress__step', 'bd-progress__step--current' => $i === $c->currentStep(), 'bd-progress__step--done' => $i < $c->currentStep()])
                                type="button" wire:click="goToStep({{ $i }})" @disabled($i >= $c->currentStep()) @if ($i === $c->currentStep()) aria-current="step" @endif>
                                <span @class(['bd-progress__dot', 'bd-progress__dot--current' => $i === $c->currentStep(), 'bd-progress__dot--done' => $i < $c->currentStep()])>{{ $i < $c->currentStep() ? '✓' : $i + 1 }}</span>
                                <span class="bd-progress__title">{{ $c->stepTitle($i) }}</span>
                            </button>
                        @endfor
                    </div></div>
                @endif
            @endif

            @foreach ($v->notices as $notice)
                <div class="bd-form__error" role="alert">{{ $notice }}</div>
            @endforeach

            @if ($labels !== [])
                <div class="bd-form__error-summary" role="alert">
                    <div class="bd-form__error-summary-title">Please complete the highlighted field{{ count($labels) === 1 ? '' : 's' }}.</div>
                    <div class="bd-form__error-summary-list">{{ implode(', ', $labels) }}</div>
                </div>
            @endif

            {{-- Every step is in the page (the ones you're not on are hidden). --}}
            @if ($stepped)
                @foreach ($c->steps() as $i => $step)
                    <div class="bd-step" data-bd-step="{{ $i }}" @if ($i !== $c->currentStep()) hidden @endif wire:key="step-{{ $i }}">
                        @include('forms.tree', ['fields' => $step, 'flat' => true])
                    </div>
                @endforeach
            @else
                @include('forms.tree', ['fields' => $c->fields(), 'flat' => false])
            @endif

            <div class="bd-nav">
                @if ($stepped)
                    <button class="bd-btn bd-btn--ghost bd-btn--back" type="button" wire:click="back" @disabled($c->isFirstStep())>Back</button>
                @endif
                @if ($stepped && ! $c->isLastStep())
                    <button class="bd-btn bd-btn--next" type="submit">Next</button>
                @else
                    <button class="bd-btn bd-btn--submit" type="submit"><span class="bd-btn__label">{{ $v->submitLabel }}</span><span class="bd-btn__busy">Sending…</span></button>
                @endif
            </div>
        </form>
    @endif
</div>
