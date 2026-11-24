{{--
    The sign-in screen (App\Livewire\SignIn). Same markup, ids and classes as
    the SDK's screen, so public/bd-sign-in.css styles it as it does everywhere.

    Boxes update the page only as they're typed in (`wire:model`); they reach
    the server when one is left after typing ("change"), as it's typed in
    while marked wrong, and with the button.
--}}
<div class="bd-sign-in" id="bd-sign-in" style="{{ $options['style'] }}" wire:loading.attr="data-busy" wire:target="submit,resend">
    <form class="bd-sign-in__form" novalidate wire:submit="submit">
        <fieldset class="bd-sign-in__fieldset">
            <div class="bd-sign-in__header">
                @if ($options['logoUrl'])
                    <img class="bd-sign-in__logo" src="{{ $options['logoUrl'] }}" alt="" onerror="this.hidden=true">
                @endif
                <h2 class="bd-sign-in__title">{{ $texts['title'] }}</h2>
                @if ($texts['subtitle'])
                    <p class="bd-sign-in__subtitle">{{ $texts['subtitle'] }}</p>
                @endif
            </div>
            <div class="bd-sign-in__body">
                <div class="bd-sign-in__body">
                    @foreach ($rows as $row)
                        <div @class(['bd-sign-in__row' => count($row) > 1]) wire:key="row-{{ implode('-', array_column($row, 'field')) }}">
                            @foreach ($row as $box)
                                @php($f = $box['field'])
                                <div @class(['bd-sign-in__field', 'bd-sign-in__field--error' => isset($wrong[$f])]) wire:key="field-{{ $f }}">
                                    <input
                                        @class(['bd-sign-in__input', 'bd-sign-in__input--code' => $f === 'code'])
                                        id="bd-sign-in-{{ $f }}"
                                        name="{{ $f }}"
                                        type="{{ $box['type'] }}"
                                        autocomplete="{{ $box['autocomplete'] }}"
                                        @if ($box['inputmode']) inputmode="{{ $box['inputmode'] }}" @endif
                                        @if ($f === 'code') maxlength="6" @endif
                                        placeholder="{{ $box['label'] }}"
                                        aria-label="{{ $box['label'] }}"
                                        aria-describedby="bd-sign-in-{{ $f }}-error"
                                        @if (isset($wrong[$f])) aria-invalid="true" @endif
                                        wire:model="values.{{ $f }}"
                                        x-on:change="$wire.$commit()"
                                        @if ($box['autoSend'])
                                            x-on:input="/^[0-9]{6}$/.test($el.value) && $nextTick(() => $wire.submit())"
                                            x-on:input.debounce.300ms="$el.getAttribute('aria-invalid') === 'true' && !/^[0-9]{6}$/.test($el.value) && $wire.$commit()"
                                        @else
                                            x-on:input.debounce.300ms="$el.getAttribute('aria-invalid') === 'true' && $wire.$commit()"
                                        @endif
                                    >
                                    <p class="bd-sign-in__error" id="bd-sign-in-{{ $f }}-error" aria-live="polite" @unless (isset($wrong[$f])) hidden @endunless>{{ $wrong[$f] ?? '' }}</p>
                                </div>
                            @endforeach
                        </div>
                    @endforeach
                    @if ($texts['hint'])
                        <p class="bd-sign-in__hint">{{ $texts['hint'] }}</p>
                    @endif
                </div>
                <p class="bd-sign-in__problem" id="bd-sign-in-problem" role="alert" @unless ($problem) hidden @endunless>{{ $problem }}</p>
                <p class="bd-sign-in__notice" id="bd-sign-in-notice" role="status" @unless ($notice) hidden @endunless>{{ $notice }}</p>
                <button type="submit" class="bd-sign-in__primary">
                    <span class="bd-sign-in__label">{{ $texts['primary'] }}</span><span class="bd-sign-in__spinner" aria-hidden="true"></span>
                </button>
            </div>
            @if ($texts['links'])
                <div class="bd-sign-in__links">
                    @foreach ($texts['links'] as [$to, $label])
                        <button type="button" class="bd-sign-in__link" name="go" value="{{ $to }}" wire:key="link-{{ $to }}"
                            @if ($to === 'resend') wire:click="resend" @else wire:click="go('{{ $to }}')" @endif>{{ $label }}</button>
                    @endforeach
                </div>
            @endif
            @if (in_array($step, ['signIn', 'createAccount'], true) && $options['oauth'])
                <div class="bd-sign-in__providers">
                    <div class="bd-sign-in__divider">{{ \App\Bd\SignInCore::WORDS['or'] }}</div>
                    @foreach ($options['oauth'] as $id)
                        <a class="bd-sign-in__provider bd-sign-in__provider--{{ $id }}" href="/api/bd-auth/customer/oauth/{{ $id }}?returnTo={{ rawurlencode($next !== null ? '/my-account?next='.rawurlencode($next) : '/my-account') }}">{!! $marks[$id] !!}<span>{{ \App\Bd\SignInCore::CONTINUE_WITH[$id] }}</span></a>
                    @endforeach
                </div>
            @endif
        </fieldset>
    </form>
</div>
