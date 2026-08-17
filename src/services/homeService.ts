import type { HomeStatus } from "../../shared/models";
import { requestJson } from "./http";

const post = (path: string, body?: Record<string, unknown>) =>
  requestJson<{ updated: true }>(`/api/home${path}`, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

export const homeService = {
  status(signal?: AbortSignal) {
    return requestJson<HomeStatus>("/api/home/status", { signal });
  },
  lightPower(id: string, on: boolean) {
    return post(`/lights/${encodeURIComponent(id)}/${on ? "on" : "off"}`);
  },
  lightSettings(
    id: string,
    settings: {
      brightness?: number;
      rgb?: [number, number, number];
      colorTemperatureKelvin?: number;
    },
  ) {
    return post(`/lights/${encodeURIComponent(id)}/settings`, settings);
  },
  acPower(on: boolean) {
    return post(`/ac/${on ? "on" : "off"}`);
  },
  acTemperature(temperature: number) {
    return post("/ac/temperature", { temperature });
  },
  acMode(mode: string) {
    return post("/ac/mode", { mode });
  },
  acFan(fan: string) {
    return post("/ac/fan", { fan });
  },
  acSwing(swing: string) {
    return post("/ac/swing", { swing });
  },
  acHorizontalSwing(swing: string) {
    return post("/ac/horizontal-swing", { swing });
  },
  acSwitch(id: string, enabled: boolean) {
    return post(`/ac/switches/${encodeURIComponent(id)}`, { enabled });
  },
  acSelect(id: string, option: string) {
    return post(`/ac/selects/${encodeURIComponent(id)}`, { option });
  },
  acNumber(id: string, value: number) {
    return post(`/ac/numbers/${encodeURIComponent(id)}`, { value });
  },
  mediaPower(kind: "tv" | "xbox", on: boolean) {
    return post(`/${kind}/${on ? "on" : "off"}`);
  },
  tvVolume(volume: number) {
    return post("/tv/volume", { volume });
  },
  tvMute(muted: boolean) {
    return post("/tv/mute", { muted });
  },
  tvSource(source: string) {
    return post("/tv/source", { source });
  },
  tvCommand(command: string) {
    return post("/tv/command", { command });
  },
  activateScene(id: string) {
    return post(`/scenes/${encodeURIComponent(id)}/activate`);
  },
};
