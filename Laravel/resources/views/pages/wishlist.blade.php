{{-- Products saved on this device with ♡ Save; <bd-wishlist> draws them there. --}}
@extends('layout')
@section('title', 'Wishlist — Store')
@section('subnav')
    <x-store-nav :count="$cartCount" />
@endsection
@section('main_class', 'bd-page')
@section('content')
    <div class="bd-section__lead">
        <span class="bd-section__eyebrow">Shop</span>
        <h1 class="bd-section__title">Wishlist</h1>
        <p class="bd-section__sub">Products you saved on this device.</p>
    </div>
    <bd-wishlist><p class="bd-loading">Loading your wishlist…</p></bd-wishlist>
@endsection
