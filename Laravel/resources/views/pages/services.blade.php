@extends('layout')
@section('title', 'Service areas')
@section('content')
    <h1>Where we work</h1>
    {{-- One row per variant tuple. This is also what a sitemap iterates. --}}
    @forelse ($variants as $variant)
        @if ($loop->first)<ul>@endif
        <li>
            <a href="{{ route('services.area', [
                'service' => data_get($variant, 'service', data_get($variant, 'params.service')),
                'area' => data_get($variant, 'area', data_get($variant, 'params.area')),
            ]) }}">
                {{ data_get($variant, 'label', 'View') }}
            </a>
        </li>
        @if ($loop->last)</ul>@endif
    @empty
        <p class="muted">No service areas defined yet.</p>
    @endforelse
@endsection
