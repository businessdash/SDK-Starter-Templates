@extends('layout')
@section('title', 'Sign in')
@section('content')
    <h1>My account</h1>

    {{--
        The business's own sign-in screen (its name, logo and brand colours
        from BD): password, emailed codes, and "Continue with Google / Apple /
        GitHub / Discord". It talks to /api/bd-auth/customer/* on this server
        (BdCustomerAuthController), which runs each step through BD — WorkOS
        underneath — and sets the httpOnly session cookie.
    --}}
    <div class="signin-card" id="bd-sign-in" data-start="{{ $start }}"></div>
@endsection

@push('scripts')
    <script type="module">
        import { mountBdSignIn } from "https://esm.sh/@businessdash/sdk@0.9.95/sign-in";
        const host = document.getElementById("bd-sign-in");
        mountBdSignIn(host, {
            start: host.dataset.start,
            redirectTo: "/my-account",
            brand: { tagline: "Sign in to see your jobs and invoices." },
        });
    </script>
@endpush
