# biab-records

Seed data for the custom database, pushed with:

```sh
npm run seed          # biab-dev sync-records --records-dir ./biab-records
```

## The shape

Each file is an array of records:

```json
{
  "object": "todos",
  "universalIdentifier": "todo-seed-welcome",
  "values": { "title": "…", "done": false },
  "relations": { "todo": "<target universalIdentifier>" }
}
```

## Two things worth understanding

**`universalIdentifier` is identity, not a name.** It is what makes re-running
`seed` *converge* rather than duplicate — the row is upserted against it. Pick
something stable and meaningful; renaming a row's title later doesn't change
who it is.

**`relations` link by the TARGET row's `universalIdentifier`**, not by a
database id you don't have yet. That's what lets a seed set reference rows in
the same push: `{ "todo": "todo-seed-welcome" }` resolves after the base rows
land. For a to-many relation, pass an array.

## Language-agnostic on purpose

This directory is plain JSON, so it is identical across every BIAB starter —
PHP, Elixir, Swift, Dart, Kotlin, and JS all seed the same way. Only the
*schema* files (`biab.config.ts`, `biab.data-model.config.ts`) are TypeScript,
because the platform verifies a canonical checksum over them and the CLI is
the one thing that computes it correctly.

## Order of operations

`seed` writes rows into objects that must already exist:

```sh
npm run sync-data-model   # push the model to the draft slot
# …promote it in the dashboard…
npm run seed              # then the rows have somewhere to go
```
