import { context } from "esbuild";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

let child;
let closing = false;

function startServer() {
  if (closing) return;
  child = spawn(process.execPath, [resolve("build/dev/server.js")], {
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV ?? "development" },
    stdio: "inherit",
  });
}

function restartServer() {
  if (!child) {
    startServer();
    return;
  }
  const previous = child;
  child = undefined;
  previous.once("exit", startServer);
  previous.kill();
}

const buildContext = await context({
  absWorkingDir: process.cwd(),
  entryPoints: ["server/index.ts"],
  outfile: resolve("build/dev/server.js"),
  bundle: true,
  packages: "external",
  platform: "node",
  target: "node22",
  format: "esm",
  sourcemap: true,
  plugins: [
    {
      name: "restart-server",
      setup(build) {
        build.onEnd((result) => {
          if (!result.errors.length) restartServer();
        });
      },
    },
  ],
});

await buildContext.watch();
console.log("Watching the Wariatkowo API server…");

async function shutdown() {
  closing = true;
  child?.kill();
  await buildContext.dispose();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
