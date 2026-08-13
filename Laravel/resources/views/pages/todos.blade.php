@extends('layout')
@section('title', 'Todos')
@section('content')
    <h1>Todos</h1>
    <p class="muted">
        The relational custom-database demo: <code>todos</code> plus
        <code>todoImages</code>, whose <code>todo</code> field is a relation
        back. Reads come from the data-model API; the create goes through the
        generated form.
    </p>

    @if (session('todo_status'))
        <p class="notice">{{ session('todo_status') }}</p>
    @endif

    <form method="POST" action="{{ route('todos.store') }}">
        @csrf
        <input type="text" name="title" required placeholder="What needs doing?">
        <input type="text" name="notes" placeholder="Notes (optional)">
        <button type="submit">Add</button>
    </form>

    @forelse ($todos as $todo)
        @if ($loop->first)<ul class="todos">@endif
        @php($id = data_get($todo, 'id'))
        <li>
            <strong>{{ data_get($todo, 'fields.title') }}</strong>
            @if (data_get($todo, 'fields.done'))<span class="done">done</span>@endif
            <p class="muted">{{ data_get($todo, 'fields.notes') }}</p>
            @foreach ($imagesByTodo[$id] ?? [] as $image)
                <img src="{{ data_get($image, 'fields.url') }}" alt="" width="120">
            @endforeach
        </li>
        @if ($loop->last)</ul>@endif
    @empty
        <p class="muted">
            @if ($configured)
                No todos yet. Run <code>npm run sync-data-model</code>, promote the
                model in the dashboard, then set the generated "Todo Form" Live.
            @else
                Connect this app to a BIAB site to see live records.
            @endif
        </p>
    @endforelse
@endsection
