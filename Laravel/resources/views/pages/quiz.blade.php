@extends('layout')
@section('title', 'Quiz')

@push('head')
    @include('forms.styles')
@endpush

@section('content')
    <div class="quiz-page">
        <livewire:bd-quiz :source="$source" :ref="$ref" />
    </div>
@endsection
