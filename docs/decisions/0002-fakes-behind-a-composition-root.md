# 0002 — Fakes behind a single composition root

**Context.** Regressions must be caught automatically, but the real
dependencies (agent CLIs, GitHub, wall-clock time) are slow, cost money,
need logins or are non-deterministic.

**Decision.**

- Every external dependency is an interface. `src/server/composition.ts` is
  the only place that picks real or fake implementations
  (`createExternalDependencies` for the real app, the test harness for tests).
  dependency-cruiser enforces that core code never imports a concrete adapter.
- Each port has one contract suite (`*.contract.ts`) run against the fake in
  `pnpm check` and against the real implementation in
  `pnpm test:contract:live` (`*.live.test.ts`).
- Git and SQLite are used for real (in temporary directories / in memory).
- Time goes through `Clock`; tests use `FakeClock` and never sleep.
- `pnpm dev:fake` runs the whole app on fakes, which is also what the
  Playwright tests use.

**Consequences.** The full server and UI are testable offline in seconds. The
fakes must be kept honest: when a live contract run disagrees with the fake,
the fake is fixed first, with a recorded fixture.
