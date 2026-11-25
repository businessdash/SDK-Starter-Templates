{{-- Back from Stripe's checkout: the order's payment status, by session id. --}}
@extends('layout')
@section('title', 'Order — Store')
@section('subnav')
    <x-store-nav :count="$cartCount" />
@endsection
@section('main_class', 'bd-page')
@section('content')
    <div class="bd-section__lead">
        <span class="bd-section__eyebrow">Shop</span>
        @if ($paid)
            <h1 class="bd-section__title">Thank you for your order</h1>
            <p class="bd-section__sub">
                Your payment went through.@if ($email) A receipt is on its way to {{ $email }}.@endif
            </p>
        @else
            <h1 class="bd-section__title">Your order</h1>
            <p class="bd-section__sub">We're confirming your payment. You'll get an email when it's done.</p>
        @endif
    </div>
    <p><a class="bd-btn" href="{{ route('store') }}">Continue shopping</a></p>
@endsection
