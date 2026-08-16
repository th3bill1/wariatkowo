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

const average = (values: Array<number | null>): number | null => {
  const present = values.filter((value): value is number => value !== null);
  return present.length
    ? present.reduce((sum, value) => sum + value, 0) / present.length
    : null;
};

const colorModes = (state: HomeAssistantState): string[] =>
  stringArray(state.attributes, "supported_color_modes");

const supportsBrightness = (state: HomeAssistantState): boolean =>
  "brightness" in state.attributes ||
  colorModes(state).some((mode) => mode !== "onoff");

const supportsColor = (state: HomeAssistantState): boolean =>
  colorModes(state).some((mode) =>
    ["rgb", "rgbw", "rgbww", "hs", "xy"].includes(mode),
  );

const supportsColorTemperature = (state: HomeAssistantState): boolean =>
  colorModes(state).includes("color_temp") ||
  "color_temp_kelvin" in state.attributes ||
  "color_temp" in state.attributes;

const colorTemperatureKelvin = (state: HomeAssistantState): number | null => {
  const kelvin = optionalNumber(state.attributes, "color_temp_kelvin");
  if (kelvin !== null) return kelvin;
  const mired = optionalNumber(state.attributes, "color_temp");
  return mired === null ? null : Math.round(1_000_000 / mired);
};

const minColorTemperatureKelvin = (
  state: HomeAssistantState,
): number | null => {
  const kelvin = optionalNumber(state.attributes, "min_color_temp_kelvin");
  if (kelvin !== null) return kelvin;
  const maxMireds = optionalNumber(state.attributes, "max_mireds");
  return maxMireds === null ? null : Math.round(1_000_000 / maxMireds);
};

const maxColorTemperatureKelvin = (
  state: HomeAssistantState,
): number | null => {
  const kelvin = optionalNumber(state.attributes, "max_color_temp_kelvin");
  if (kelvin !== null) return kelvin;
  const minMireds = optionalNumber(state.attributes, "min_mireds");
  return minMireds === null ? null : Math.round(1_000_000 / minMireds);
};

function lightStatus(
  config: HomeAssistantConfig["lights"][number],
  memberStates: Array<HomeAssistantState | undefined>,
): HomeLight {
  const states = memberStates.filter((state): state is HomeAssistantState =>
    Boolean(state),
  );
  const usableStates = states.filter((state) => available(state));
  const representativeStates = usableStates.length ? usableStates : states;
  const rawBrightness = average(
    representativeStates.map((state) =>
      optionalNumber(state.attributes, "brightness"),
    ),
  );
  const rgbValues = representativeStates
    .map((state) =>
      Array.isArray(state.attributes.rgb_color) &&
      state.attributes.rgb_color.length === 3 &&
      state.attributes.rgb_color.every((item) => typeof item === "number")
        ? (state.attributes.rgb_color as [number, number, number])
        : null,
    )
    .filter((rgb): rgb is [number, number, number] => rgb !== null);
  const rgb = rgbValues.length
    ? ([0, 1, 2].map((channel) =>
        Math.round(
          rgbValues.reduce((sum, value) => sum + value[channel], 0) /
            rgbValues.length,
        ),
      ) as [number, number, number])
    : null;
  const minimums = representativeStates
    .map(minColorTemperatureKelvin)
    .filter((value): value is number => value !== null);
  const maximums = representativeStates
    .map(maxColorTemperatureKelvin)
    .filter((value): value is number => value !== null);
  const allConfiguredStatesKnown = states.length === config.entityIds.length;
  return {
    id: config.id,
    name: config.name,
    state: usableStates.some((state) => state.state === "on")
      ? "on"
      : usableStates.length
        ? usableStates.every((state) => state.state === "off")
          ? "off"
          : usableStates[0].state
        : "unavailable",
    available: usableStates.length > 0,
    brightness:
      rawBrightness === null ? null : Math.round((rawBrightness / 255) * 100),
    rgb,
    colorTemperatureKelvin: (() => {
      const value = average(representativeStates.map(colorTemperatureKelvin));
      return value === null ? null : Math.round(value);
    })(),
    minColorTemperatureKelvin: minimums.length ? Math.max(...minimums) : null,
    maxColorTemperatureKelvin: maximums.length ? Math.min(...maximums) : null,
    supportsBrightness:
      allConfiguredStatesKnown && states.every(supportsBrightness),
    supportsColor: allConfiguredStatesKnown && states.every(supportsColor),
    supportsColorTemperature:
      allConfiguredStatesKnown && states.every(supportsColorTemperature),
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
      lightStatus(
        light,
        light.entityIds.map((entityId) => stateMap.get(entityId)),
      ),
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
