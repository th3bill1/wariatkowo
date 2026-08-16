import { describe, expect, it, vi } from "vitest";
import type { Env } from "../server/_shared/http";
import type {
  HomeAssistantClient,
  HomeAssistantState,
} from "../server/homeAssistant/client";
import type { HomeAssistantConfig } from "../server/homeAssistant/config";
import { loadHomeAssistantConfig } from "../server/homeAssistant/config";
import { getHomeStatus } from "../server/homeAssistant/status";
import { createHomeHandlers } from "../server/homeAssistant/routes";

const config: HomeAssistantConfig = {
  url: "http://home-assistant.local:8123",
  token: "test-token",
  timeoutMs: 1_000,
  lights: [
    {
      id: "boskie-swiatlo",
      name: "Boskie światło",
      entityIds: ["light.ceiling_1", "light.ceiling_2", "light.ceiling_3"],
    },
    {
      id: "miskolampa",
      name: "Miśkolampa",
      entityIds: ["light.lamp"],
    },
  ],
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
  it("parses grouped and standalone logical lights", () => {
    const variables = [
      "HA_LIGHT_LIVING_ROOM",
      "HA_LIGHT_BEDROOM",
      "HA_LIGHTS_JSON",
    ] as const;
    const previous = Object.fromEntries(
      variables.map((name) => [name, process.env[name]]),
    );
    delete process.env.HA_LIGHT_LIVING_ROOM;
    delete process.env.HA_LIGHT_BEDROOM;
    process.env.HA_LIGHTS_JSON = JSON.stringify({
      "boskie-swiatlo": {
        name: "Boskie światło",
        entityIds: [
          "light.192_168_0_12",
          "light.192_168_0_13",
          "light.192_168_0_14",
        ],
      },
      miskolampa: {
        name: "Miśkolampa",
        entityId: "light.192_168_0_15",
      },
    });

    try {
      expect(loadHomeAssistantConfig().lights).toEqual([
        {
          id: "boskie-swiatlo",
          name: "Boskie światło",
          entityIds: [
            "light.192_168_0_12",
            "light.192_168_0_13",
            "light.192_168_0_14",
          ],
        },
        {
          id: "miskolampa",
          name: "Miśkolampa",
          entityIds: ["light.192_168_0_15"],
        },
      ]);
    } finally {
      for (const name of variables) {
        const value = previous[name];
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  });

  it("normalizes device capabilities without returning entity ids", async () => {
    const client = {
      getStates: async () => [
        state("light.ceiling_1", "off", {
          brightness: 64,
          rgb_color: [100, 40, 240],
          supported_color_modes: ["rgb", "color_temp"],
          color_temp_kelvin: 3_200,
          min_color_temp_kelvin: 1_700,
          max_color_temp_kelvin: 6_500,
        }),
        state("light.ceiling_2", "on", {
          brightness: 128,
          rgb_color: [120, 50, 255],
          supported_color_modes: ["rgb", "color_temp"],
          color_temp_kelvin: 3_400,
          min_color_temp_kelvin: 1_700,
          max_color_temp_kelvin: 6_500,
        }),
        state("light.ceiling_3", "on", {
          brightness: 192,
          rgb_color: [140, 60, 255],
          supported_color_modes: ["rgb", "color_temp"],
          color_temp_kelvin: 3_600,
          min_color_temp_kelvin: 1_700,
          max_color_temp_kelvin: 6_500,
        }),
        state("light.lamp", "off", {
          supported_color_modes: ["rgb", "color_temp"],
          min_color_temp_kelvin: 1_700,
          max_color_temp_kelvin: 6_500,
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
      id: "boskie-swiatlo",
      name: "Boskie światło",
      state: "on",
      brightness: 50,
      colorTemperatureKelvin: 3_400,
      minColorTemperatureKelvin: 1_700,
      maxColorTemperatureKelvin: 6_500,
      supportsColor: true,
      supportsColorTemperature: true,
    });
    expect(snapshot.lights[1]).toMatchObject({
      id: "miskolampa",
      name: "Miśkolampa",
      state: "off",
      supportsBrightness: true,
      supportsColor: true,
    });
    expect(snapshot.ac).toMatchObject({
      currentTemperature: 24,
      targetTemperature: 22,
    });
    expect(snapshot.xbox?.mediaTitle).toBe("Forza Horizon");
    expect(JSON.stringify(snapshot)).not.toContain("light.ceiling_1");
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

  it("applies grouped Kelvin settings to every ceiling bulb", async () => {
    const callService = vi.fn(async () => []);
    const client = {
      getState: vi.fn(async (entityId: string) =>
        state(entityId, "on", {
          supported_color_modes: ["rgb", "color_temp"],
          brightness: 128,
          min_color_temp_kelvin: 1_700,
          max_color_temp_kelvin: 6_500,
        }),
      ),
      callService,
    } as unknown as HomeAssistantClient;
    const statement = {
      bind: vi.fn(),
      first: vi.fn(async () => ({
        session_id: "session-1",
        id: "member-misiek",
        name: "Misiek",
        slug: "misiek",
      })),
    };
    statement.bind.mockReturnValue(statement);
    const env = {
      DB: { prepare: vi.fn(() => statement) },
    } as unknown as Env;
    const handlers = createHomeHandlers(config, client);
    const response = await handlers.lightSettings({
      request: new Request(
        "http://localhost/api/home/lights/boskie-swiatlo/settings",
        {
          method: "POST",
          headers: {
            Cookie: "wariatkowo_session=test-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ colorTemperatureKelvin: 3_500 }),
        },
      ),
      env,
      params: { id: "boskie-swiatlo" },
    });

    expect(response.status).toBe(200);
    expect(client.getState).toHaveBeenCalledTimes(3);
    expect(callService).toHaveBeenCalledWith("light", "turn_on", {
      entity_id: ["light.ceiling_1", "light.ceiling_2", "light.ceiling_3"],
      color_temp_kelvin: 3_500,
    });
  });
});
