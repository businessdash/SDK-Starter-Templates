# BusinessDash SDK — Angular starter

The project lives one level down, in [`Angular/`](./Angular/README.md).

That nesting is not an accident: the inner directory is the thing you clone or
copy, and keeping it self-contained means its `package.json`, lockfile and
`node_modules` belong to the app rather than to this folder.

```sh
cd Angular
pnpm install
cp .env.example .env.local   # then fill in the three BD_* variables
pnpm dev
```

See [`Angular/README.md`](./Angular/README.md) for setup, environment
variables, schema sync, seeding and CRUD.
