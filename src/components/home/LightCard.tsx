import { useEffect, useState } from "react";
import { Lightbulb } from "lucide-react";
import type { HomeLight } from "../../../shared/models";
import { homeService } from "../../services/homeService";
import { DeviceState } from "./DeviceState";

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
  const [brightness, setBrightness] = useState(light.brightness ?? 100);
  const [colorTemperatureKelvin, setColorTemperatureKelvin] = useState(
    defaultColorTemperature(light),
  );
  const [color, setColor] = useState(() => rgbHex(light.rgb));
  useEffect(() => {
    setBrightness(light.brightness ?? 100);
    setColorTemperatureKelvin(defaultColorTemperature(light));
    setColor(rgbHex(light.rgb));
  }, [light]);

  return (
    <article className="home-device-card">
      <header className="home-device-card__header">
        <span className="home-device-card__icon home-device-card__icon--light">
          <Lightbulb aria-hidden="true" />
        </span>
        <div>
          <h3>{light.name}</h3>
          <DeviceState available={light.available} state={light.state} />
        </div>
      </header>
      <div className="home-power-actions">
        <button
          className="primary-button"
          disabled={busy || !light.available}
          onClick={() => void run(() => homeService.lightPower(light.id, true))}
          type="button"
        >
          Włącz
        </button>
        <button
          className="secondary-button"
          disabled={busy || !light.available}
          onClick={() =>
            void run(() => homeService.lightPower(light.id, false))
          }
          type="button"
        >
          Wyłącz
        </button>
      </div>
      {light.supportsBrightness ? (
        <div>
          <label className="home-range">
            <span>
              Jasność <strong>{brightness}%</strong>
            </span>
            <input
              disabled={busy || !light.available}
              max="100"
              min="1"
              onChange={(event) => setBrightness(Number(event.target.value))}
              type="range"
              value={brightness}
            />
          </label>
          <button
            className="ghost-button home-save-button"
            disabled={busy || !light.available}
            onClick={() =>
              void run(() =>
                homeService.lightSettings(light.id, { brightness }),
              )
            }
            type="button"
          >
            Ustaw jasność
          </button>
        </div>
      ) : null}
      {light.supportsColor ? (
        <div>
          <label className="home-color-field">
            <span>Kolor</span>
            <input
              disabled={busy || !light.available}
              onChange={(event) => setColor(event.target.value)}
              type="color"
              value={color}
            />
          </label>
          <button
            className="ghost-button home-save-button"
            disabled={busy || !light.available}
            onClick={() =>
              void run(() =>
                homeService.lightSettings(light.id, { rgb: hexRgb(color) }),
              )
            }
            type="button"
          >
            Ustaw kolor
          </button>
        </div>
      ) : null}
      {light.supportsColorTemperature ? (
        <div>
          <label className="home-range">
            <span>
              Barwa <strong>{colorTemperatureKelvin} K</strong>
            </span>
            <input
              disabled={busy || !light.available}
              max={light.maxColorTemperatureKelvin ?? 6_500}
              min={light.minColorTemperatureKelvin ?? 2_000}
              onChange={(event) =>
                setColorTemperatureKelvin(Number(event.target.value))
              }
              step="50"
              type="range"
              value={colorTemperatureKelvin}
            />
          </label>
          <button
            className="ghost-button home-save-button"
            disabled={busy || !light.available}
            onClick={() =>
              void run(() =>
                homeService.lightSettings(light.id, {
                  colorTemperatureKelvin,
                }),
              )
            }
            type="button"
          >
            Ustaw barwę
          </button>
        </div>
      ) : null}
    </article>
  );
}
