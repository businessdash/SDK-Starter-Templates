{{-- The screen's buttons. The primary one submits the form, so Enter in a box presses it. --}}
@if ($s['actions'] !== [])
    <div class="bd-quiz__actions">
        @foreach ($s['actions'] as $action)
            @if ($action['href'] !== null)
                <a @class(['bd-quiz__button', 'bd-quiz__button--primary' => $action['primary']]) href="{{ $action['href'] }}" data-quiz-action="{{ $action['id'] }}">{{ $action['label'] }}</a>
            @elseif ($action['primary'])
                <button class="bd-quiz__button bd-quiz__button--primary" type="submit" @disabled(! $action['enabled']) data-quiz-action="{{ $action['id'] }}" wire:key="action-{{ $action['id'] }}">{{ $action['label'] }}</button>
            @else
                <button class="bd-quiz__button" type="button" wire:click="act(@js($action['id']))" @disabled(! $action['enabled']) data-quiz-action="{{ $action['id'] }}" wire:key="action-{{ $action['id'] }}">{{ $action['label'] }}</button>
            @endif
        @endforeach
    </div>
@endif
