import { build } from "esbuild";
import { rmSync } from "node:fs";
import { resolve } from "node:path";

const outdir = resolve("build/server");
rmSync(outdir, { force: true, recursive: true });

await build({
  absWorkingDir: process.cwd(),
  entryPoints: {
    index: "server/index.ts",
    "db-migrate": "server/db/migrateCli.ts",
    "db-import": "server/db/importD1Cli.ts",
  },
  outdir,
  bundle: true,
  packages: "external",
  platform: "node",
  target: "node22",
  format: "esm",
  sourcemap: true,
  logLevel: "info",
});
