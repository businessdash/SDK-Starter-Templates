@extends('layout')
@section('title', $title)

@push('head')
    @include('forms.styles')
@endpush

@section('content')
    <livewire:bd-form :slug="$slug" />
@endsection
