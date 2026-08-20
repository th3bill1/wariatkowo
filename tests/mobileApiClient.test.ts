import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "../packages/api-client/src";
import { findWidgetLightId, normalizeDeviceName } from "../packages/api-client/src/deviceRoutes";

describe("mobile API client", () => {
  it("adds a bearer session and parses the API envelope", async () => {
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer private-session");
      return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    const api = createApiClient({ baseUrl: "https://wariatkowo.test", tokenStore: { get: async () => "private-session", set: async () => {}, clear: async () => {} }, fetch: fetcher as typeof fetch });
    await expect(api.tasks.list()).resolves.toEqual([]);
  });
  it("maps Polish widget names to the configured logical light", () => {
    expect(normalizeDeviceName("Boskie światło")).toBe("boskie-swiatlo");
    expect(findWidgetLightId([{ id: "lamp-bedroom", name: "Miśkolampa" }], "miskolampa")).toBe("lamp-bedroom");
  });
});
