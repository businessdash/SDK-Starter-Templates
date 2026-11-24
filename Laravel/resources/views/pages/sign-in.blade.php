@extends('layout')
@section('title', 'Sign in')

@push('head')
    <link rel="stylesheet" href="/bd-sign-in.css">
@endpush

@section('content')
    <h1>My account</h1>

    {{--
        The business's own sign-in screen (its name, logo and brand colours
        from BD): password, emailed codes, and "Continue with Google / Apple /
        GitHub / Discord" — a Livewire component (App\Livewire\SignIn) that
        runs each step through BD, WorkOS underneath, and sets the httpOnly
        session cookie.
    --}}
    <div class="signin-card">
        <livewire:sign-in :start="$start" :problem="$problem" :next="$next" />
    </div>
@endsection

@push('scripts')
    <script>
        // Focus the box the screen asks for, once Livewire has applied the update.
        window.addEventListener('bd-sign-in-focus', (e) =>
            requestAnimationFrame(() => document.getElementById(e.detail.id)?.focus())
        );
    </script>
@endpush
