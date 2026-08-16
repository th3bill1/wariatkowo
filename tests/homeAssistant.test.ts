import { describe, expect, it, vi } from "vitest";
import type { Env } from "../server/_shared/http";
import type {
  HomeAssistantClient,
  HomeAssistantState,
} from "../server/homeAssistant/client";
import type { HomeAssistantConfig } from "../server/homeAssistant/config";
import { getHomeStatus } from "../server/homeAssistant/status";
import { createHomeHandlers } from "../server/homeAssistant/routes";

const config: HomeAssistantConfig = {
  url: "http://home-assistant.local:8123",
  token: "test-token",
  timeoutMs: 1_000,
  lights: [{ id: "living-room", name: "Salon", entityId: "light.salon" }],
  ac: { id: "ac", name: "Klimatyzacja", entityId: "climate.ac" },
  tv: { id: "tv", name: "Telewizor", entityId: "media_player.tv" },
  xbox: { id: "xbox", name: "Xbox", entityId: "media_player.xbox" },
  scenes: [{ id: "movie", name: "Tryb filmowy", entityId: "scene.movie" }],
};

function state(
  entityId: string,
  value: string,
  attributes: Record<string, unknown> = {},
): HomeAssistantState {
  return {
    entity_id: entityId,
    state: value,
    attributes,
    last_changed: "2026-08-16T12:00:00Z",
    last_updated: "2026-08-16T12:00:00Z",
  };
}

describe("Home Assistant status normalization", () => {
  it("normalizes device capabilities without returning entity ids", async () => {
    const client = {
      getStates: async () => [
        state("light.salon", "on", {
          brightness: 128,
          rgb_color: [120, 50, 255],
          supported_color_modes: ["rgb", "color_temp"],
          color_temp: 300,
          min_mireds: 153,
          max_mireds: 500,
        }),
        state("climate.ac", "cool", {
          current_temperature: 24,
          temperature: 22,
          hvac_modes: ["off", "cool"],
        }),
        state("media_player.tv", "off", { volume_level: 0.25 }),
        state("media_player.xbox", "on", { media_title: "Forza Horizon" }),
      ],
    } as unknown as HomeAssistantClient;
    const snapshot = await getHomeStatus(config, client);
    expect(snapshot.connected).toBe(true);
    expect(snapshot.lights[0]).toMatchObject({
      id: "living-room",
      brightness: 50,
      supportsColor: true,
      supportsColorTemperature: true,
    });
    expect(snapshot.ac).toMatchObject({
      currentTemperature: 24,
      targetTemperature: 22,
    });
    expect(snapshot.xbox?.mediaTitle).toBe("Forza Horizon");
    expect(JSON.stringify(snapshot)).not.toContain("light.salon");
    expect(JSON.stringify(snapshot)).not.toContain("test-token");
  });

  it("returns an offline snapshot instead of failing the core app", async () => {
    const client = {
      getStates: async () => {
        throw new Error("Home Assistant offline");
      },
    } as unknown as HomeAssistantClient;
    const snapshot = await getHomeStatus(config, client);
    expect(snapshot.connected).toBe(false);
    expect(snapshot.lights[0].available).toBe(false);
    expect(snapshot.ac?.available).toBe(false);
  });

  it("never performs control actions through GET requests", async () => {
    const callService = vi.fn();
    const client = { callService } as unknown as HomeAssistantClient;
    const handlers = createHomeHandlers(config, client);
    const response = await handlers.tvOn({
      request: new Request("http://localhost/api/home/tv/on"),
      env: {} as Env,
      params: {},
    });
    expect(response.status).toBe(405);
    expect(callService).not.toHaveBeenCalled();
  });
});
