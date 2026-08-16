import { useEffect, useRef, useState } from "react";
import { Lightbulb } from "lucide-react";
import type { HomeLight } from "../../../shared/models";
import { homeService } from "../../services/homeService";
import { DeviceState } from "./DeviceState";

const LIGHT_PRESETS = [
  { label: "Noc", color: "#ff9a3d", brightness: 15 },
  { label: "Relaks", color: "#ffb85c", brightness: 35 },
  { label: "Wieczór", color: "#ffd37d", brightness: 55 },
  { label: "Czytanie", color: "#ffe4a8", brightness: 75 },
  { label: "Jasno", color: "#fff0cf", brightness: 100 },
] as const;

type LightSetting = Parameters<typeof homeService.lightSettings>[1];
type SettingTimer = "brightness" | "color" | "temperature";

function rgbHex(rgb: [number, number, number] | null): string {
  return rgb
    ? `#${rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`
    : "#ffd37d";
}
function hexRgb(value: string): [number, number, number] {
  return [1, 3, 5].map((offset) =>
    Number.parseInt(value.slice(offset, offset + 2), 16),
  ) as [number, number, number];
}

function defaultColorTemperature(light: HomeLight): number {
  if (light.colorTemperatureKelvin !== null) {
    return Math.round(light.colorTemperatureKelvin);
  }
  const minimum = light.minColorTemperatureKelvin ?? 2_000;
  const maximum = light.maxColorTemperatureKelvin ?? 6_500;
  return Math.round((minimum + maximum) / 2);
}

export function LightCard({
  light,
  busy,
  run,
}: {
  light: HomeLight;
  busy: boolean;
  run: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const isOn = light.state === "on";
  const [brightness, setBrightness] = useState(light.brightness ?? 100);
  const [colorTemperatureKelvin, setColorTemperatureKelvin] = useState(
    defaultColorTemperature(light),
  );
  const [color, setColor] = useState(() => rgbHex(light.rgb));
  const runRef = useRef(run);
  const timers = useRef<Partial<Record<SettingTimer, number>>>({});
  useEffect(() => {
    runRef.current = run;
  }, [run]);
  useEffect(
    () => () => {
      Object.values(timers.current).forEach((timer) =>
        window.clearTimeout(timer),
      );
    },
    [],
  );
  useEffect(() => {
    setBrightness(light.brightness ?? 100);
    if (light.colorTemperatureKelvin !== null) {
      setColorTemperatureKelvin(Math.round(light.colorTemperatureKelvin));
    }
    setColor(rgbHex(light.rgb));
  }, [light]);

  const scheduleSetting = (
    timerName: SettingTimer,
    setting: LightSetting,
    delay = 350,
  ) => {
    window.clearTimeout(timers.current[timerName]);
    timers.current[timerName] = window.setTimeout(() => {
      delete timers.current[timerName];
      void runRef.current(() => homeService.lightSettings(light.id, setting));
    }, delay);
  };

  const selectColor = (value: string, delay?: number) => {
    setColor(value);
    scheduleSetting("color", { rgb: hexRgb(value) }, delay);
  };

  const applyPreset = (preset: (typeof LIGHT_PRESETS)[number]) => {
    Object.values(timers.current).forEach((timer) =>
      window.clearTimeout(timer),
    );
    timers.current = {};
    setColor(preset.color);
    setBrightness(preset.brightness);
    void runRef.current(() =>
      homeService.lightSettings(light.id, {
        brightness: preset.brightness,
        rgb: hexRgb(preset.color),
      }),
    );
  };

  return (
    <article className="home-device-card">
      <header className="home-device-card__header">
        <button
          aria-label={isOn ? `Wyłącz ${light.name}` : `Włącz ${light.name}`}
          aria-pressed={isOn}
          className={`home-device-card__icon home-device-card__icon--light home-light-toggle${isOn ? " home-light-toggle--on" : ""}`}
          disabled={busy || !light.available}
          onClick={() =>
            void run(() => homeService.lightPower(light.id, !isOn))
          }
          type="button"
        >
          <Lightbulb aria-hidden="true" />
        </button>
        <div>
          <h3>{light.name}</h3>
          <DeviceState available={light.available} state={light.state} />
        </div>
      </header>
      {light.supportsBrightness ? (
        <div className="home-light-control">
          <label className="home-range">
            <span>
              Jasność <strong>{brightness}%</strong>
            </span>
            <input
              disabled={busy || !light.available}
              max="100"
              min="1"
              onChange={(event) => {
                const value = Number(event.target.value);
                setBrightness(value);
                scheduleSetting("brightness", { brightness: value });
              }}
              type="range"
              value={brightness}
            />
          </label>
        </div>
      ) : null}
      {light.supportsColor ? (
        <div className="home-light-control">
          <label className="home-color-field">
            <span>Kolor</span>
            <input
              disabled={busy || !light.available}
              onChange={(event) => selectColor(event.target.value)}
              type="color"
              value={color}
            />
          </label>
          <div
            aria-label="Gotowe ustawienia koloru i jasności"
            className="home-color-presets"
            role="group"
          >
            {LIGHT_PRESETS.map((preset) => (
              <button
                aria-label={`${preset.label}, jasność ${preset.brightness}%`}
                className={`home-color-preset ${color.toLowerCase() === preset.color && brightness === preset.brightness ? "home-color-preset--selected" : ""}`}
                disabled={busy || !light.available}
                key={preset.label}
                onClick={() => applyPreset(preset)}
                style={{ backgroundColor: preset.color }}
                title={`${preset.label}: ${preset.brightness}%`}
                type="button"
              >
                <span>{preset.label}</span>
                <strong>{preset.brightness}%</strong>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {light.supportsColorTemperature ? (
        <div className="home-light-control">
          <label className="home-range">
            <span>
              Barwa <strong>{colorTemperatureKelvin} K</strong>
            </span>
            <input
              disabled={busy || !light.available}
              max={light.maxColorTemperatureKelvin ?? 6_500}
              min={light.minColorTemperatureKelvin ?? 2_000}
              onChange={(event) => {
                const value = Number(event.target.value);
                setColorTemperatureKelvin(value);
                scheduleSetting("temperature", {
                  colorTemperatureKelvin: value,
                });
              }}
              step="50"
              type="range"
              value={colorTemperatureKelvin}
            />
          </label>
        </div>
      ) : null}
    </article>
  );
}
