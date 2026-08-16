import { build } from "esbuild";
import { spawn } from "node:child_process";
import { basename, resolve } from "node:path";

const entryPoint = process.argv[2];
if (!entryPoint) throw new Error("Missing TypeScript tool entry point.");

const output = resolve(
  "build/tools",
  `${basename(entryPoint, ".ts")}-${process.pid}.js`,
);
await build({
  absWorkingDir: process.cwd(),
  entryPoints: [entryPoint],
  outfile: output,
  bundle: true,
  packages: "external",
  platform: "node",
  target: "node22",
  format: "esm",
  logLevel: "silent",
});

const child = spawn(process.execPath, [output, ...process.argv.slice(3)], {
  env: process.env,
  stdio: "inherit",
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
