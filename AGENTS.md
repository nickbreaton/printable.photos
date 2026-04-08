## Solid JS

This project uses Solid JS 2.0 (beta). It works similar to Solid JS v1, one of the largest changes is promises can now a source of signals and its "suspends" into the "Loading" component.

A second large change is createEffect's first function now must be pure to support async signals. The second callback function is where side effects run.
