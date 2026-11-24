@extends('layout')
@section('title', 'Delete your account')
@section('content')
    @if ($state === 'confirm')
        <h1>Delete your account?</h1>
        <p>This deletes your account with us: your profile, saved settings and anything waiting in your cart. You'll be signed out.</p>
        <p class="muted">Records of past orders and invoices stay with us, as the law asks. This can't be undone.</p>
        <form method="POST" action="/api/bd-auth/delete-account">
            @csrf
            <label><input type="checkbox" name="confirm" value="yes" required> I understand my account is deleted for good.</label>
            <p><button type="submit">Delete my account</button> <a href="/my-account">Cancel</a></p>
        </form>
    @elseif ($state === 'deleted')
        <h1>Your account is deleted</h1>
        <p>You're signed out. Thank you for being with us.</p>
        <p><a href="/">Done</a></p>
    @elseif ($state === 'failed')
        <h1>Something went wrong</h1>
        <p>Your account couldn't be deleted just now. Please try again in a minute.</p>
        <p><a href="/api/bd-auth/delete-account">Try again</a></p>
    @else
        <h1>Sign in first</h1>
        <p>Sign in with the account you want to delete, then come back to this page.</p>
        <p><a href="/my-account">Sign in</a></p>
    @endif
@endsection
