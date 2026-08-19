import { isAuthResponse, requireAuth } from "../_shared/auth";
import {
  error,
  methodNotAllowed,
  readJsonBody,
  success,
} from "../_shared/http";
import type { WebRouteHandler } from "../webHandler";
import {
  HomeAssistantClient,
  HomeAssistantError,
  type HomeAssistantState,
} from "./client";
import type { HomeAssistantConfig } from "./config";
import { getHomeStatus } from "./status";

type HandlerContext = Parameters<WebRouteHandler>[0];
type AuthenticatedHandler = (context: HandlerContext) => Promise<Response>;
const TV_COMMANDS = new Set([
  "KEY_HOME",
  "KEY_UP",
  "KEY_DOWN",
  "KEY_LEFT",
  "KEY_RIGHT",
  "KEY_ENTER",
  "KEY_RETURN",
  "KEY_BACK",
  "KEY_PLAY",
  "KEY_PAUSE",
  "KEY_STOP",
]);

function withAuth(
  handler: AuthenticatedHandler,
  method: "GET" | "POST" = "POST",
): WebRouteHandler {
  return async (context) => {
    if (context.request.method !== method) return methodNotAllowed([method]);
    const auth = await requireAuth(context.request, context.env);
    if (isAuthResponse(auth)) return auth;
    return handler(context);
  };
}

function serviceError(caught: unknown): Response {
  if (caught instanceof HomeAssistantError) {
    return error(
      caught.kind === "not-configured"
        ? "NOT_CONFIGURED"
        : "SERVICE_UNAVAILABLE",
      caught.message,
      503,
    );
  }
  console.error("Home Assistant operation failed", caught);
  return error(
    "SERVICE_UNAVAILABLE",
    "Nie udało się wykonać operacji w Home Assistant.",
    503,
  );
}

async function bodyObject(
  request: Request,
): Promise<Record<string, unknown> | Response> {
  try {
    const body = await readJsonBody(request);
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : error("VALIDATION_ERROR", "Treść żądania musi być obiektem JSON.");
  } catch {
    return error(
      "VALIDATION_ERROR",
      "Treść żądania nie jest poprawnym JSON-em.",
    );
  }
}

function entityDomain(entityId: string): string {
  return entityId.split(".", 1)[0];
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function configuredMedia(config: HomeAssistantConfig, kind: "tv" | "xbox") {
  return kind === "tv" ? config.tv : config.xbox;
}

function entityTarget(entityIds: string[]): string | string[] {
  return entityIds.length === 1 ? entityIds[0] : entityIds;
}

function lightColorModes(state: HomeAssistantState): string[] {
  return stringList(state.attributes.supported_color_modes);
}

function lightSupportsBrightness(state: HomeAssistantState): boolean {
  return (
    "brightness" in state.attributes ||
    lightColorModes(state).some((mode) => mode !== "onoff")
  );
}

function lightSupportsColor(state: HomeAssistantState): boolean {
  return lightColorModes(state).some((mode) =>
    ["rgb", "rgbw", "rgbww", "hs", "xy"].includes(mode),
  );
}

function lightSupportsColorTemperature(state: HomeAssistantState): boolean {
  return (
    lightColorModes(state).includes("color_temp") ||
    "color_temp_kelvin" in state.attributes ||
    "color_temp" in state.attributes
  );
}

function minimumColorTemperatureKelvin(state: HomeAssistantState): number {
  if (typeof state.attributes.min_color_temp_kelvin === "number") {
    return state.attributes.min_color_temp_kelvin;
  }
  if (typeof state.attributes.max_mireds === "number") {
    return Math.round(1_000_000 / state.attributes.max_mireds);
  }
  return 2_000;
}

function maximumColorTemperatureKelvin(state: HomeAssistantState): number {
  if (typeof state.attributes.max_color_temp_kelvin === "number") {
    return state.attributes.max_color_temp_kelvin;
  }
  if (typeof state.attributes.min_mireds === "number") {
    return Math.round(1_000_000 / state.attributes.min_mireds);
  }
  return 6_500;
}

async function callPower(
  client: HomeAssistantClient,
  entityId: string,
  on: boolean,
): Promise<void> {
  const domain = entityDomain(entityId);
  const service = domain === "button" ? "press" : on ? "turn_on" : "turn_off";
  if (!on && domain === "button") {
    throw new HomeAssistantError(
      "not-configured",
      "Ta encja obsługuje tylko włączanie urządzenia.",
    );
  }
  await client.callService(domain, service, { entity_id: entityId });
}

export function createHomeHandlers(
  config: HomeAssistantConfig,
  client: HomeAssistantClient,
): Record<string, WebRouteHandler> {
  const status = withAuth(
    async () => success(await getHomeStatus(config, client)),
    "GET",
  );

  const lightPower = (on: boolean) =>
    withAuth(async (context) => {
      const light = config.lights.find((item) => item.id === context.params.id);
      if (!light)
        return error("NOT_FOUND", "Nie znaleziono tego światła.", 404);
      try {
        await client.callService("light", on ? "turn_on" : "turn_off", {
          entity_id: entityTarget(light.entityIds),
        });
        return success({ updated: true });
      } catch (caught) {
        return serviceError(caught);
      }
    });

  const lightSettings = withAuth(async (context) => {
    const light = config.lights.find((item) => item.id === context.params.id);
    if (!light) return error("NOT_FOUND", "Nie znaleziono tego światła.", 404);
    const body = await bodyObject(context.request);
    if (body instanceof Response) return body;
    try {
      const states = await Promise.all(
        light.entityIds.map((entityId) => client.getState(entityId)),
      );
      const serviceData: Record<string, unknown> = {
        entity_id: entityTarget(light.entityIds),
      };
      let settings = 0;

      if (body.rgb !== undefined && body.colorTemperatureKelvin !== undefined) {
        return error(
          "VALIDATION_ERROR",
          "Kolor RGB i temperatura barwowa muszą być ustawiane osobno.",
        );
      }

      if (body.brightness !== undefined) {
        if (
          typeof body.brightness !== "number" ||
          !Number.isInteger(body.brightness) ||
          body.brightness < 1 ||
          body.brightness > 100
        ) {
          return error("VALIDATION_ERROR", "Jasność musi wynosić od 1 do 100.");
        }
        if (!states.every(lightSupportsBrightness)) {
          return error(
            "VALIDATION_ERROR",
            "To światło nie obsługuje jasności.",
          );
        }
        serviceData.brightness = Math.round((body.brightness / 100) * 255);
        settings += 1;
      }

      if (body.rgb !== undefined) {
        if (
          !Array.isArray(body.rgb) ||
          body.rgb.length !== 3 ||
          !body.rgb.every(
            (channel) =>
              typeof channel === "number" &&
              Number.isInteger(channel) &&
              channel >= 0 &&
              channel <= 255,
          )
        ) {
          return error(
            "VALIDATION_ERROR",
            "Kolor RGB musi zawierać trzy liczby 0–255.",
          );
        }
        if (!states.every(lightSupportsColor)) {
          return error("VALIDATION_ERROR", "To światło nie obsługuje koloru.");
        }
        serviceData.rgb_color = body.rgb;
        settings += 1;
      }

      if (body.colorTemperatureKelvin !== undefined) {
        const min = Math.max(...states.map(minimumColorTemperatureKelvin));
        const max = Math.min(...states.map(maximumColorTemperatureKelvin));
        if (
          typeof body.colorTemperatureKelvin !== "number" ||
          !Number.isInteger(body.colorTemperatureKelvin) ||
          body.colorTemperatureKelvin < min ||
          body.colorTemperatureKelvin > max
        ) {
          return error(
            "VALIDATION_ERROR",
            `Temperatura barwowa musi wynosić od ${min} K do ${max} K.`,
          );
        }
        if (!states.every(lightSupportsColorTemperature)) {
          return error(
            "VALIDATION_ERROR",
            "To światło nie obsługuje temperatury barwowej.",
          );
        }
        serviceData.color_temp_kelvin = body.colorTemperatureKelvin;
        settings += 1;
      }

      if (!settings) {
        return error("VALIDATION_ERROR", "Nie podano ustawień światła.");
      }
      await client.callService("light", "turn_on", serviceData);
      return success({ updated: true });
    } catch (caught) {
      return serviceError(caught);
    }
  });

  const acPower = (on: boolean) =>
    withAuth(async () => {
      if (!config.ac)
        return error(
          "NOT_CONFIGURED",
          "Klimatyzacja nie jest skonfigurowana.",
          503,
        );
      try {
        await client.callService("climate", on ? "turn_on" : "turn_off", {
          entity_id: config.ac.entityId,
        });
        return success({ updated: true });
      } catch (caught) {
        return serviceError(caught);
      }
    });

  const acValue = (
    kind: "temperature" | "mode" | "fan" | "swing" | "horizontalSwing",
  ) =>
    withAuth(async (context) => {
      if (!config.ac)
        return error(
          "NOT_CONFIGURED",
          "Klimatyzacja nie jest skonfigurowana.",
          503,
        );
      const body = await bodyObject(context.request);
      if (body instanceof Response) return body;
      try {
        const state = await client.getState(config.ac.entityId);
        let service: string;
        let serviceData: Record<string, unknown> = {
          entity_id: config.ac.entityId,
        };
        if (kind === "temperature") {
          const min =
            typeof state.attributes.min_temp === "number"
              ? state.attributes.min_temp
              : 16;
          const max =
            typeof state.attributes.max_temp === "number"
              ? state.attributes.max_temp
              : 30;
          const step =
            typeof state.attributes.target_temp_step === "number"
              ? state.attributes.target_temp_step
              : 1;
          const alignedToStep =
            typeof body.temperature === "number" &&
            Math.abs(
              (body.temperature - min) / step -
                Math.round((body.temperature - min) / step),
            ) < 1e-6;
          if (
            typeof body.temperature !== "number" ||
            !Number.isFinite(body.temperature) ||
            body.temperature < min ||
            body.temperature > max ||
            !alignedToStep
          ) {
            return error(
              "VALIDATION_ERROR",
              `Temperatura musi wynosić od ${min}°C do ${max}°C (krok ${step}°C).`,
            );
          }
          service = "set_temperature";
          serviceData.temperature = body.temperature;
        } else {
          const valueName =
            kind === "mode"
              ? "mode"
              : kind === "horizontalSwing"
                ? "swing"
                : kind;
          const requested = body[valueName];
          const attribute =
            kind === "mode"
              ? "hvac_modes"
              : kind === "fan"
                ? "fan_modes"
                : kind === "horizontalSwing"
                  ? "swing_horizontal_modes"
                  : "swing_modes";
          const supported = stringList(state.attributes[attribute]);
          if (typeof requested !== "string" || !supported.includes(requested)) {
            return error(
              "VALIDATION_ERROR",
              "Wybrane ustawienie nie jest obsługiwane.",
            );
          }
          if (kind === "mode") {
            service = "set_hvac_mode";
            serviceData.hvac_mode = requested;
          } else if (kind === "horizontalSwing") {
            service = "set_swing_horizontal_mode";
            serviceData.swing_horizontal_mode = requested;
          } else {
            service = `set_${kind}_mode`;
            serviceData[`${kind}_mode`] = requested;
          }
        }
        await client.callService("climate", service, serviceData);
        return success({ updated: true });
      } catch (caught) {
        return serviceError(caught);
      }
    });

  const acSwitch = withAuth(async (context) => {
    if (!config.ac) {
      return error(
        "NOT_CONFIGURED",
        "Klimatyzacja nie jest skonfigurowana.",
        503,
      );
    }
    const control = config.ac.switches.find(
      (item) => item.id === context.params.id,
    );
    if (!control) {
      return error(
        "NOT_FOUND",
        "Nie znaleziono tej funkcji klimatyzacji.",
        404,
      );
    }
    const body = await bodyObject(context.request);
    if (body instanceof Response) return body;
    if (typeof body.enabled !== "boolean") {
      return error(
        "VALIDATION_ERROR",
        "Pole enabled musi być wartością logiczną.",
      );
    }
    try {
      await client.callService(
        "switch",
        body.enabled ? "turn_on" : "turn_off",
        {
          entity_id: control.entityId,
        },
      );
      return success({ updated: true });
    } catch (caught) {
      return serviceError(caught);
    }
  });

  const acSelect = withAuth(async (context) => {
    if (!config.ac) {
      return error(
        "NOT_CONFIGURED",
        "Klimatyzacja nie jest skonfigurowana.",
        503,
      );
    }
    const control = config.ac.selects.find(
      (item) => item.id === context.params.id,
    );
    if (!control) {
      return error(
        "NOT_FOUND",
        "Nie znaleziono tej funkcji klimatyzacji.",
        404,
      );
    }
    const body = await bodyObject(context.request);
    if (body instanceof Response) return body;
    try {
      const state = await client.getState(control.entityId);
      const options = stringList(state.attributes.options);
      if (typeof body.option !== "string" || !options.includes(body.option)) {
        return error("VALIDATION_ERROR", "Wybrana opcja nie jest obsługiwana.");
      }
      await client.callService("select", "select_option", {
        entity_id: control.entityId,
        option: body.option,
      });
      return success({ updated: true });
    } catch (caught) {
      return serviceError(caught);
    }
  });

  const acNumber = withAuth(async (context) => {
    if (!config.ac) {
      return error(
        "NOT_CONFIGURED",
        "Klimatyzacja nie jest skonfigurowana.",
        503,
      );
    }
    const control = config.ac.numbers.find(
      (item) => item.id === context.params.id,
    );
    if (!control) {
      return error(
        "NOT_FOUND",
        "Nie znaleziono tej funkcji klimatyzacji.",
        404,
      );
    }
    const body = await bodyObject(context.request);
    if (body instanceof Response) return body;
    try {
      const state = await client.getState(control.entityId);
      const min =
        typeof state.attributes.min === "number" ? state.attributes.min : 0;
      const max =
        typeof state.attributes.max === "number" ? state.attributes.max : 100;
      const step =
        typeof state.attributes.step === "number" && state.attributes.step > 0
          ? state.attributes.step
          : 1;
      const alignedToStep =
        typeof body.value === "number" &&
        Math.abs(
          (body.value - min) / step - Math.round((body.value - min) / step),
        ) < 1e-6;
      if (
        typeof body.value !== "number" ||
        !Number.isFinite(body.value) ||
        body.value < min ||
        body.value > max ||
        !alignedToStep
      ) {
        return error(
          "VALIDATION_ERROR",
          `Wartość musi wynosić od ${min} do ${max} (krok ${step}).`,
        );
      }
      await client.callService("number", "set_value", {
        entity_id: control.entityId,
        value: body.value,
      });
      return success({ updated: true });
    } catch (caught) {
      return serviceError(caught);
    }
  });

  const mediaPower = (kind: "tv" | "xbox", on: boolean) =>
    withAuth(async () => {
      const media = configuredMedia(config, kind);
      const entityId = media?.entityId ?? media?.remoteEntityId;
      if (!entityId)
        return error(
          "NOT_CONFIGURED",
          "Urządzenie nie jest skonfigurowane.",
          503,
        );
      try {
        await callPower(client, entityId, on);
        return success({ updated: true });
      } catch (caught) {
        return serviceError(caught);
      }
    });

  const tvValue = (kind: "volume" | "mute" | "source" | "command") =>
    withAuth(async (context) => {
      if (!config.tv)
        return error(
          "NOT_CONFIGURED",
          "Telewizor nie jest skonfigurowany.",
          503,
        );
      const body = await bodyObject(context.request);
      if (body instanceof Response) return body;
      try {
        if (kind === "command") {
          if (!config.tv.remoteEntityId) {
            return error(
              "NOT_CONFIGURED",
              "Pilot telewizora nie jest skonfigurowany.",
              503,
            );
          }
          if (
            typeof body.command !== "string" ||
            !TV_COMMANDS.has(body.command)
          ) {
            return error(
              "VALIDATION_ERROR",
              "Ta komenda pilota nie jest dozwolona.",
            );
          }
          await client.callService("remote", "send_command", {
            entity_id: config.tv.remoteEntityId,
            command: body.command,
          });
          return success({ updated: true });
        }
        if (!config.tv.entityId) {
          return error(
            "NOT_CONFIGURED",
            "Encja multimedialna telewizora nie jest skonfigurowana.",
            503,
          );
        }
        const state = await client.getState(config.tv.entityId);
        if (kind === "volume") {
          if (
            typeof body.volume !== "number" ||
            body.volume < 0 ||
            body.volume > 100
          ) {
            return error(
              "VALIDATION_ERROR",
              "Głośność musi wynosić od 0 do 100.",
            );
          }
          await client.callService("media_player", "volume_set", {
            entity_id: config.tv.entityId,
            volume_level: body.volume / 100,
          });
        } else if (kind === "mute") {
          if (typeof body.muted !== "boolean") {
            return error(
              "VALIDATION_ERROR",
              "Pole muted musi być wartością logiczną.",
            );
          }
          await client.callService("media_player", "volume_mute", {
            entity_id: config.tv.entityId,
            is_volume_muted: body.muted,
          });
        } else {
          const sources = stringList(state.attributes.source_list);
          if (
            typeof body.source !== "string" ||
            !sources.includes(body.source)
          ) {
            return error("VALIDATION_ERROR", "To źródło nie jest dostępne.");
          }
          await client.callService("media_player", "select_source", {
            entity_id: config.tv.entityId,
            source: body.source,
          });
        }
        return success({ updated: true });
      } catch (caught) {
        return serviceError(caught);
      }
    });

  const scene = withAuth(async (context) => {
    const configured = config.scenes.find(
      (item) => item.id === context.params.id,
    );
    if (!configured)
      return error("NOT_FOUND", "Nie znaleziono tego trybu domu.", 404);
    try {
      await client.callService(entityDomain(configured.entityId), "turn_on", {
        entity_id: configured.entityId,
      });
      return success({ updated: true });
    } catch (caught) {
      return serviceError(caught);
    }
  });

  return {
    status,
    lightOn: lightPower(true),
    lightOff: lightPower(false),
    lightSettings,
    acOn: acPower(true),
    acOff: acPower(false),
    acTemperature: acValue("temperature"),
    acMode: acValue("mode"),
    acFan: acValue("fan"),
    acSwing: acValue("swing"),
    acHorizontalSwing: acValue("horizontalSwing"),
    acSwitch,
    acSelect,
    acNumber,
    tvOn: mediaPower("tv", true),
    tvOff: mediaPower("tv", false),
    tvVolume: tvValue("volume"),
    tvMute: tvValue("mute"),
    tvSource: tvValue("source"),
    tvCommand: tvValue("command"),
    xboxOn: mediaPower("xbox", true),
    xboxOff: mediaPower("xbox", false),
    scene,
  };
}
