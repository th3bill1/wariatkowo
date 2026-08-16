import { build } from "esbuild";
import { resolve } from "node:path";

await build({
  absWorkingDir: process.cwd(),
  entryPoints: {
    index: "server/index.ts",
    "db-migrate": "server/db/migrateCli.ts",
    "db-import": "server/db/importD1Cli.ts",
    "setup-pins": "server/db/setupPinsCli.ts",
  },
  outdir: resolve("build/server"),
  bundle: true,
  packages: "external",
  platform: "node",
  target: "node22",
  format: "esm",
  sourcemap: true,
  logLevel: "info",
});
