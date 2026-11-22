# 0001 — TypeScript without a build step on the server

**Context.** The server should be quick to run and easy for agents to change.
Node 22.18+ runs TypeScript files directly by stripping types. TypeScript 7
(the native compiler) is current, but tools we rely on (dependency-cruiser,
our code-rules checker) use the TypeScript compiler API, which 7.0 does not
offer.

**Decision.**

- The server runs `.ts` files directly with Node (no `tsx`, no bundling).
  Imports use explicit `.ts` extensions.
- `erasableSyntaxOnly` is on: no enums, namespaces or constructor parameter
  properties, because Node cannot strip them.
- TypeScript is pinned to 6.0 for type checking until the tools support 7.
- The web app is bundled by Vite as usual.

**Consequences.** No build step for the server and no source maps to manage.
Upgrading to TypeScript 7 is a separate, deliberate change.
