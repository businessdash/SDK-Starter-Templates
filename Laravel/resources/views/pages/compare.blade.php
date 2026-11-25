{{--
    Up to four products side by side. The products come from ?ids=a,b, so a
    comparison can be shared; opened without ids, <bd-compare> moves this
    browser's picks into the URL.
--}}
@extends('layout')
@section('title', 'Compare — Store')
@section('subnav')
    <x-store-nav :count="$cartCount" />
@endsection
@section('main_class', 'bd-page')
@section('content')
    <div class="bd-section__lead">
        <span class="bd-section__eyebrow">Shop</span>
        <h1 class="bd-section__title">Compare</h1>
        <p class="bd-section__sub">Up to four products side by side.</p>
    </div>
    <bd-compare><x-element-data :value="$compare" /></bd-compare>
@endsection
