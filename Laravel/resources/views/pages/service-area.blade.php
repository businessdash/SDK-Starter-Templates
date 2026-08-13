@extends('layout')
@section('title', data_get($page, 'seo.title', ucfirst($service) . ' in ' . ucfirst($area)))
@section('content')
    <article>
        <h1>{{ data_get($page, 'heading', ucfirst($service) . ' in ' . ucfirst($area)) }}</h1>
        <div>{!! data_get($page, 'html', e(data_get($page, 'body', ''))) !!}</div>
    </article>
@endsection

@push('head')
    @if ($description = data_get($page, 'seo.description'))
        <meta name="description" content="{{ $description }}">
    @endif
@endpush
