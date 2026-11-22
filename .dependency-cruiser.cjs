module.exports = {
  forbidden: [
    { name: "no-circular", severity: "error", from: {}, to: { circular: true } },
    {
      name: "web-does-not-import-server",
      severity: "error",
      from: { path: "^src/web/" },
      to: { path: "^src/server/" },
    },
    {
      name: "shared-is-standalone",
      severity: "error",
      from: { path: "^src/shared/" },
      to: { path: "^src/(server|web)/" },
    },
    {
      name: "core-depends-on-interfaces-not-concrete-adapters",
      severity: "error",
      from: {
        path: "^src/server/",
        pathNot:
          "^src/server/(composition\\.ts|backends/(fake|claude-code)/)|/testing/|\\.test\\.ts$",
      },
      to: { path: "^src/server/backends/(fake|claude-code)/" },
    },
    {
      name: "production-code-does-not-import-test-helpers",
      severity: "error",
      from: { pathNot: "\\.test\\.tsx?$|\\.contract\\.ts$|/testing/" },
      to: { path: "/testing/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    exclude: { path: "^src/server/db/migrations" },
  },
};
