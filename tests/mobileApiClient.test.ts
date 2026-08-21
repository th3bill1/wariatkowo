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
  it("reuses the existing web endpoints for native parity features", async () => {
    const requests: Array<{ url: string; method: string; body?: string }> = [];
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({
        url,
        method: init?.method ?? "GET",
        body: typeof init?.body === "string" ? init.body : undefined,
      });
      return new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const api = createApiClient({
      baseUrl: "https://wariatkowo.test/",
      fetch: fetcher as typeof fetch,
    });

    await api.shopping.products("mleko & chleb", "recent");
    await api.shopping.suggestions("mleko", true, 6);
    await api.shopping.removeProduct("produkt/1");
    await api.calendar.disconnectGoogle();
    await api.home.tvSource("HDMI 1");

    expect(requests).toEqual([
      {
        url: "https://wariatkowo.test/api/shopping/products?q=mleko%20%26%20chleb&sort=recent",
        method: "GET",
        body: undefined,
      },
      {
        url: "https://wariatkowo.test/api/shopping/products/suggestions?q=mleko&excludeActive=true&limit=6",
        method: "GET",
        body: undefined,
      },
      {
        url: "https://wariatkowo.test/api/shopping/products/produkt%2F1",
        method: "DELETE",
        body: undefined,
      },
      {
        url: "https://wariatkowo.test/api/integrations/google-calendar/disconnect",
        method: "POST",
        body: undefined,
      },
      {
        url: "https://wariatkowo.test/api/home/tv/source",
        method: "POST",
        body: JSON.stringify({ source: "HDMI 1" }),
      },
    ]);
  });
});
