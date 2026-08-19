import { afterEach, describe, expect, it, vi } from "vitest";
import { methodNotAllowed } from "../server/_shared/http";
import {
  ApiError,
  requestJson,
  requestJsonBody,
  requestVoid,
} from "../src/services/http";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("frontend API client", () => {
  it("unwraps typed success responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ data: { id: "task-1", title: "Test" } }),
      ),
    );

    await expect(requestJson<{ id: string }>("/api/tasks")).resolves.toEqual({
      id: "task-1",
      title: "Test",
    });
  });

  it("preserves structured server errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { error: { code: "DUPLICATE", message: "Już istnieje." } },
          { status: 409 },
        ),
      ),
    );

    const request = requestJson("/api/shopping");
    await expect(request).rejects.toMatchObject({
      name: "ApiError",
      status: 409,
      code: "DUPLICATE",
      message: "Już istnieje.",
    });
  });

  it("uses a safe fallback for malformed error payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("upstream failed", { status: 502 })),
    );

    await expect(requestVoid("/api/calendar/event-1")).rejects.toEqual(
      new ApiError(
        "Wystąpił błąd podczas wykonywania operacji.",
        502,
        "INTERNAL_ERROR",
      ),
    );
  });

  it("constructs JSON mutations consistently", async () => {
    const fetchMock = vi.fn(async () => Response.json({ data: { ok: true } }));
    vi.stubGlobal("fetch", fetchMock);

    await requestJsonBody("/api/tasks/task-1", "PATCH", { completed: true });

    expect(fetchMock).toHaveBeenCalledWith("/api/tasks/task-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
  });
});

describe("backend HTTP responses", () => {
  it("advertises allowed methods on 405 responses", () => {
    const response = methodNotAllowed(["GET", "POST"]);

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, POST");
  });
});
