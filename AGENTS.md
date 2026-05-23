## General

Dont run the build on each change, I will do that myself. Don't even mention it.

## Design

See @docs/DESIGN.md

## Technologies

### Solid JS

This project uses Solid JS 2.0 (beta). It works similar to Solid JS v1, one of the largest changes is promises can now a source of signals and its "suspends" into the "Loading" component.

A second large change is createEffect's first function now must be pure to support async signals. The second callback function is where side effects run.

Be sure not to destructure props, thats a big no.

See [docs/SOLID_2.md](docs/SOLID_2.md) for repo-specific Solid 2.0 migration notes and current beta caveats.

### Effect

When writing Effect code, inspect @repos/effect/ for examples of idiomatic usage, tests, module structure, and API design. Treat it as the source of truth for Effect patterns.

## Vendored Repositories

This project vendors external repositories under @repos/

  - Use vendored repositories as read-only reference material when working with related libraries
  - Prefer examples and patterns from the vendored source code over generated guesses or web search results
  - Do not edit files under @repos/ unless explicitly asked
  - Do not import from @repos/ - application code should continue importing from normal package dependencies
