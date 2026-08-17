import "dotenv/config";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { onRequest as authLogin } from "./api/auth/login";
import { onRequest as authLogout } from "./api/auth/logout";
import { onRequest as authMembers } from "./api/auth/members";
import { onRequest as authSession } from "./api/auth/session";
import { onRequest as calendarIndex } from "./api/calendar/index";
import { onRequest as calendarItem } from "./api/calendar/[id]";
import { onRequest as shoppingIndex } from "./api/shopping/index";
import { onRequest as shoppingItem } from "./api/shopping/[id]";
import { onRequest as shoppingCompleted } from "./api/shopping/completed";
import { onRequest as shoppingProducts } from "./api/shopping/products/index";
import { onRequest as shoppingProduct } from "./api/shopping/products/[id]";
import { onRequest as shoppingSuggestions } from "./api/shopping/products/suggestions";
import { onRequest as taskStats } from "./api/task-stats";
import { onRequest as tasksIndex } from "./api/tasks/index";
import { onRequest as taskItem } from "./api/tasks/[id]";
import type { ApiErrorResponse } from "../shared/api";
import type { Env } from "./_shared/http";
import { openDatabase } from "./db/database";
import { adaptWebHandler, type WebRouteHandler } from "./webHandler";
import { HomeAssistantClient } from "./homeAssistant/client";
import { loadHomeAssistantConfig } from "./homeAssistant/config";
import { createHomeHandlers } from "./homeAssistant/routes";

function booleanEnvironment(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return fallback;
}

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const database = openDatabase();
const env: Env = {
  DB: database,
  COOKIE_SECURE: booleanEnvironment(
    "COOKIE_SECURE",
    process.env.NODE_ENV === "production",
  ),
};
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.get("/api/health", (_request, response) => {
  database.raw.prepare("SELECT 1").get();
  response.json({ status: "ok" });
});

app.use(
  "/api",
  express.raw({
    type: () => true,
    limit: "64kb",
  }),
);

const route = (path: string, handler: unknown) =>
  app.all(path, adaptWebHandler(handler as WebRouteHandler, env));

const homeConfig = loadHomeAssistantConfig();
const homeHandlers = createHomeHandlers(
  homeConfig,
  new HomeAssistantClient(homeConfig),
);

route("/api/auth/members", authMembers);
route("/api/auth/session", authSession);
route("/api/auth/login", authLogin);
route("/api/auth/logout", authLogout);
route("/api/tasks", tasksIndex);
route("/api/tasks/:id", taskItem);
route("/api/task-stats", taskStats);
route("/api/shopping/completed", shoppingCompleted);
route("/api/shopping/products/suggestions", shoppingSuggestions);
route("/api/shopping/products", shoppingProducts);
route("/api/shopping/products/:id", shoppingProduct);
route("/api/shopping", shoppingIndex);
route("/api/shopping/:id", shoppingItem);
route("/api/calendar", calendarIndex);
route("/api/calendar/:id", calendarItem);
route("/api/home/status", homeHandlers.status);
route("/api/home/lights/:id/on", homeHandlers.lightOn);
route("/api/home/lights/:id/off", homeHandlers.lightOff);
route("/api/home/lights/:id/settings", homeHandlers.lightSettings);
route("/api/home/ac/on", homeHandlers.acOn);
route("/api/home/ac/off", homeHandlers.acOff);
route("/api/home/ac/temperature", homeHandlers.acTemperature);
route("/api/home/ac/mode", homeHandlers.acMode);
route("/api/home/ac/fan", homeHandlers.acFan);
route("/api/home/ac/swing", homeHandlers.acSwing);
route("/api/home/ac/horizontal-swing", homeHandlers.acHorizontalSwing);
route("/api/home/ac/switches/:id", homeHandlers.acSwitch);
route("/api/home/ac/selects/:id", homeHandlers.acSelect);
route("/api/home/ac/numbers/:id", homeHandlers.acNumber);
route("/api/home/tv/on", homeHandlers.tvOn);
route("/api/home/tv/off", homeHandlers.tvOff);
route("/api/home/tv/volume", homeHandlers.tvVolume);
route("/api/home/tv/mute", homeHandlers.tvMute);
route("/api/home/tv/source", homeHandlers.tvSource);
route("/api/home/tv/command", homeHandlers.tvCommand);
route("/api/home/xbox/on", homeHandlers.xboxOn);
route("/api/home/xbox/off", homeHandlers.xboxOff);
route("/api/home/scenes/:id/activate", homeHandlers.scene);

app.use("/api", (_request, response) => {
  const body: ApiErrorResponse = {
    error: { code: "NOT_FOUND", message: "Nie znaleziono endpointu API." },
  };
  response.status(404).json(body);
});

const frontendPath = resolve(process.env.FRONTEND_DIST_PATH ?? "dist");
if (existsSync(frontendPath)) {
  app.use(express.static(frontendPath, { index: false, fallthrough: true }));
  app.use((request, response, next) => {
    if (request.method !== "GET") {
      next();
      return;
    }
    response.sendFile(resolve(frontendPath, "index.html"));
  });
} else if (process.env.NODE_ENV === "production") {
  console.warn(`Frontend build not found at ${frontendPath}.`);
}

app.use(
  (
    error: unknown,
    _request: Request,
    response: Response,
    _next: NextFunction,
  ) => {
    console.error("Unhandled server error", error);
    const body: ApiErrorResponse = {
      error: {
        code: "INTERNAL_ERROR",
        message: "Wystąpił nieoczekiwany błąd serwera.",
      },
    };
    response.status(500).json(body);
  },
);

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Wariatkowo is listening on 0.0.0.0:${port}`);
});

function shutdown(signal: string): void {
  console.log(`Received ${signal}; shutting down.`);
  server.close(() => {
    database.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
