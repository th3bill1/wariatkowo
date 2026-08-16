import type {
  HomeClimate,
  HomeLight,
  HomeMediaDevice,
  HomeStatus,
} from "../../shared/models";
import type { HomeAssistantConfig } from "./config";
import { HomeAssistantClient, type HomeAssistantState } from "./client";

const numberAttribute = (
  attributes: Record<string, unknown>,
  name: string,
  fallback: number,
): number =>
  typeof attributes[name] === "number" ? attributes[name] : fallback;
const optionalNumber = (
  attributes: Record<string, unknown>,
  name: string,
): number | null =>
  typeof attributes[name] === "number" ? attributes[name] : null;
const stringArray = (
  attributes: Record<string, unknown>,
  name: string,
): string[] =>
  Array.isArray(attributes[name])
    ? (attributes[name] as unknown[]).filter(
        (item): item is string => typeof item === "string",
      )
    : [];
const available = (state?: HomeAssistantState): boolean =>
  Boolean(state && state.state !== "unavailable" && state.state !== "unknown");

function lightStatus(
  config: HomeAssistantConfig["lights"][number],
  state?: HomeAssistantState,
): HomeLight {
  const attributes = state?.attributes ?? {};
  const colorModes = stringArray(attributes, "supported_color_modes");
  const rgb = Array.isArray(attributes.rgb_color)
    ? attributes.rgb_color.filter(
        (item): item is number => typeof item === "number",
      )
    : [];
  const rawBrightness = optionalNumber(attributes, "brightness");
  const minMireds = optionalNumber(attributes, "min_mireds");
  const maxMireds = optionalNumber(attributes, "max_mireds");
  return {
    id: config.id,
    name: config.name,
    state: state?.state ?? "unavailable",
    available: available(state),
    brightness:
      rawBrightness === null ? null : Math.round((rawBrightness / 255) * 100),
    rgb: rgb.length === 3 ? (rgb as [number, number, number]) : null,
    colorTemperature: optionalNumber(attributes, "color_temp"),
    minColorTemperature: minMireds,
    maxColorTemperature: maxMireds,
    supportsBrightness:
      rawBrightness !== null || colorModes.some((mode) => mode !== "onoff"),
    supportsColor: colorModes.some((mode) =>
      ["rgb", "rgbw", "rgbww", "hs", "xy"].includes(mode),
    ),
    supportsColorTemperature:
      colorModes.includes("color_temp") || "color_temp" in attributes,
  };
}

function climateStatus(
  config: NonNullable<HomeAssistantConfig["ac"]>,
  state?: HomeAssistantState,
): HomeClimate {
  const attributes = state?.attributes ?? {};
  return {
    id: "ac",
    name: config.name,
    state: state?.state ?? "unavailable",
    available: available(state),
    currentTemperature: optionalNumber(attributes, "current_temperature"),
    targetTemperature: optionalNumber(attributes, "temperature"),
    minTemperature: numberAttribute(attributes, "min_temp", 16),
    maxTemperature: numberAttribute(attributes, "max_temp", 30),
    temperatureStep: numberAttribute(attributes, "target_temp_step", 1),
    modes: stringArray(attributes, "hvac_modes"),
    fanMode:
      typeof attributes.fan_mode === "string" ? attributes.fan_mode : null,
    fanModes: stringArray(attributes, "fan_modes"),
    swingMode:
      typeof attributes.swing_mode === "string" ? attributes.swing_mode : null,
    swingModes: stringArray(attributes, "swing_modes"),
  };
}

function mediaStatus(
  config: NonNullable<HomeAssistantConfig["tv"]>,
  state?: HomeAssistantState,
): HomeMediaDevice {
  const attributes = state?.attributes ?? {};
  const rawVolume = optionalNumber(attributes, "volume_level");
  const sources = stringArray(attributes, "source_list");
  return {
    id: config.id,
    name: config.name,
    state: state?.state ?? "unavailable",
    available: available(state),
    volume: rawVolume === null ? null : Math.round(rawVolume * 100),
    muted:
      typeof attributes.is_volume_muted === "boolean"
        ? attributes.is_volume_muted
        : null,
    source: typeof attributes.source === "string" ? attributes.source : null,
    sources,
    mediaTitle:
      typeof attributes.media_title === "string"
        ? attributes.media_title
        : null,
    supportsVolume: rawVolume !== null,
    supportsMute: typeof attributes.is_volume_muted === "boolean",
    supportsSource: sources.length > 0,
    supportsCommands: Boolean(config.remoteEntityId),
  };
}

function stateFor(
  states: Map<string, HomeAssistantState>,
  entityId?: string,
  fallbackEntityId?: string,
): HomeAssistantState | undefined {
  return (
    (entityId && states.get(entityId)) ||
    (fallbackEntityId && states.get(fallbackEntityId)) ||
    undefined
  );
}

export async function getHomeStatus(
  config: HomeAssistantConfig,
  client: HomeAssistantClient,
): Promise<HomeStatus> {
  let stateMap = new Map<string, HomeAssistantState>();
  let connected = true;
  let message: string | null = null;
  try {
    const states = await client.getStates();
    stateMap = new Map(states.map((state) => [state.entity_id, state]));
  } catch (error) {
    connected = false;
    message =
      error instanceof Error ? error.message : "Home Assistant jest offline.";
  }
  return {
    connected,
    message,
    updatedAt: new Date().toISOString(),
    lights: config.lights.map((light) =>
      lightStatus(light, stateMap.get(light.entityId)),
    ),
    ac: config.ac
      ? climateStatus(config.ac, stateMap.get(config.ac.entityId))
      : null,
    tv: config.tv
      ? mediaStatus(
          config.tv,
          stateFor(stateMap, config.tv.entityId, config.tv.remoteEntityId),
        )
      : null,
    xbox: config.xbox
      ? mediaStatus(
          config.xbox,
          stateFor(stateMap, config.xbox.entityId, config.xbox.remoteEntityId),
        )
      : null,
    scenes: config.scenes.map(({ id, name }) => ({ id, name })),
  };
}
