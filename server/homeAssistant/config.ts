type LightConfig = { id: string; name: string; entityIds: string[] };
type MappingCandidate = {
  name?: unknown;
  entityId?: unknown;
  entityIds?: unknown;
};
type MediaConfig = {
  id: "tv" | "xbox";
  name: string;
  entityId?: string;
  remoteEntityId?: string;
};
type SceneConfig = { id: string; name: string; entityId: string };

export type HomeAssistantConfig = {
  url: string;
  token: string;
  timeoutMs: number;
  lights: LightConfig[];
  ac?: { id: "ac"; name: string; entityId: string };
  tv?: MediaConfig;
  xbox?: MediaConfig;
  scenes: SceneConfig[];
};

function value(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function logicalId(candidate: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate);
}

function entityId(candidate: string): boolean {
  return /^[a-z0-9_]+\.[a-z0-9_]+$/.test(candidate);
}

function parseJsonMapping(variable: string): Record<string, MappingCandidate> {
  const raw = value(variable);
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${variable} must be valid JSON.`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${variable} must be a JSON object.`);
  }
  return parsed as Record<string, MappingCandidate>;
}

function parseLights(): LightConfig[] {
  const lights = new Map<string, LightConfig>();
  const legacy = [
    ["living-room", "Salon", value("HA_LIGHT_LIVING_ROOM")],
    ["bedroom", "Sypialnia", value("HA_LIGHT_BEDROOM")],
  ] as const;
  for (const [id, name, entityId] of legacy) {
    if (entityId) lights.set(id, { id, name, entityIds: [entityId] });
  }
  for (const [id, candidate] of Object.entries(
    parseJsonMapping("HA_LIGHTS_JSON"),
  )) {
    const rawEntityIds =
      typeof candidate?.entityId === "string"
        ? [candidate.entityId]
        : Array.isArray(candidate?.entityIds)
          ? candidate.entityIds
          : [];
    const entityIds = [
      ...new Set(
        rawEntityIds
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim()),
      ),
    ];
    if (
      !logicalId(id) ||
      !candidate ||
      typeof candidate !== "object" ||
      rawEntityIds.length === 0 ||
      entityIds.length !== rawEntityIds.length ||
      entityIds.some((item) => !entityId(item)) ||
      (candidate.name !== undefined && typeof candidate.name !== "string")
    ) {
      throw new Error("HA_LIGHTS_JSON contains an invalid light entry.");
    }
    lights.set(id, {
      id,
      name: candidate.name?.trim() || id,
      entityIds,
    });
  }
  return [...lights.values()];
}

function parseScenes(): SceneConfig[] {
  const scenes = new Map<string, SceneConfig>();
  const legacy = [
    ["gaming", "Tryb grania", value("HA_SCENE_GAMING")],
    ["movie", "Tryb filmowy", value("HA_SCENE_MOVIE")],
    ["good-night", "Dobranoc", value("HA_SCENE_GOOD_NIGHT")],
  ] as const;
  for (const [id, name, entityId] of legacy) {
    if (entityId) scenes.set(id, { id, name, entityId });
  }
  for (const [id, candidate] of Object.entries(
    parseJsonMapping("HA_SCENES_JSON"),
  )) {
    if (
      !logicalId(id) ||
      !candidate ||
      typeof candidate !== "object" ||
      typeof candidate.entityId !== "string" ||
      !entityId(candidate.entityId.trim()) ||
      (candidate.name !== undefined && typeof candidate.name !== "string")
    ) {
      throw new Error("HA_SCENES_JSON contains an invalid scene entry.");
    }
    scenes.set(id, {
      id,
      name: candidate.name?.trim() || id,
      entityId: candidate.entityId.trim(),
    });
  }
  for (const scene of scenes.values()) {
    if (
      !scene.entityId.startsWith("scene.") &&
      !scene.entityId.startsWith("script.")
    ) {
      throw new Error(
        `Configured scene ${scene.id} must be a scene.* or script.* entity.`,
      );
    }
  }
  return [...scenes.values()];
}

function mediaConfig(
  id: "tv" | "xbox",
  name: string,
  entityVariable: string,
  remoteVariable: string,
): MediaConfig | undefined {
  const entityId = value(entityVariable);
  const remoteEntityId = value(remoteVariable);
  return entityId || remoteEntityId
    ? { id, name, entityId, remoteEntityId }
    : undefined;
}

export function loadHomeAssistantConfig(): HomeAssistantConfig {
  const timeout = Number(value("HA_TIMEOUT_MS") ?? 5_000);
  if (!Number.isInteger(timeout) || timeout < 500 || timeout > 30_000) {
    throw new Error("HA_TIMEOUT_MS must be between 500 and 30000.");
  }
  const url = value("HA_URL")?.replace(/\/$/, "") ?? "";
  if (url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
        throw new Error();
    } catch {
      throw new Error("HA_URL must be a valid HTTP(S) URL.");
    }
  }
  const acEntity = value("HA_AC");
  const config: HomeAssistantConfig = {
    url,
    token: value("HA_TOKEN") ?? "",
    timeoutMs: timeout,
    lights: parseLights(),
    ac: acEntity
      ? { id: "ac", name: "Klimatyzacja", entityId: acEntity }
      : undefined,
    tv: mediaConfig("tv", "Telewizor", "HA_TV", "HA_TV_REMOTE"),
    xbox: mediaConfig("xbox", "Xbox", "HA_XBOX", "HA_XBOX_REMOTE"),
    scenes: parseScenes(),
  };
  const configuredEntities = [
    ...config.lights.flatMap((light) => light.entityIds),
    config.ac?.entityId,
    config.tv?.entityId,
    config.tv?.remoteEntityId,
    config.xbox?.entityId,
    config.xbox?.remoteEntityId,
    ...config.scenes.map((scene) => scene.entityId),
  ].filter((candidate): candidate is string => Boolean(candidate));
  if (configuredEntities.some((candidate) => !entityId(candidate))) {
    throw new Error("A Home Assistant entity ID has an invalid format.");
  }
  return config;
}
