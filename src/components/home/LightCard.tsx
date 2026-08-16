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
  const [colorTemperature, setColorTemperature] = useState(
    light.colorTemperature ?? light.minColorTemperature ?? 250,
  );
  const [color, setColor] = useState(() => rgbHex(light.rgb));
  useEffect(() => {
    setBrightness(light.brightness ?? 100);
    setColorTemperature(
      light.colorTemperature ?? light.minColorTemperature ?? 250,
    );
    setColor(rgbHex(light.rgb));
  }, [light]);

  const save = () =>
    run(() =>
      homeService.lightSettings(light.id, {
        ...(light.supportsBrightness ? { brightness } : {}),
        ...(light.supportsColor ? { rgb: hexRgb(color) } : {}),
        ...(light.supportsColorTemperature ? { colorTemperature } : {}),
      }),
    );

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
      ) : null}
      {light.supportsColor ? (
        <label className="home-color-field">
          <span>Kolor</span>
          <input
            disabled={busy || !light.available}
            onChange={(event) => setColor(event.target.value)}
            type="color"
            value={color}
          />
        </label>
      ) : null}
      {light.supportsColorTemperature ? (
        <label className="home-range">
          <span>
            Barwa <strong>{colorTemperature} mired</strong>
          </span>
          <input
            disabled={busy || !light.available}
            max={light.maxColorTemperature ?? 500}
            min={light.minColorTemperature ?? 153}
            onChange={(event) =>
              setColorTemperature(Number(event.target.value))
            }
            type="range"
            value={colorTemperature}
          />
        </label>
      ) : null}
      {light.supportsBrightness ||
      light.supportsColor ||
      light.supportsColorTemperature ? (
        <button
          className="ghost-button home-save-button"
          disabled={busy || !light.available}
          onClick={() => void save()}
          type="button"
        >
          Zapisz ustawienia
        </button>
      ) : null}
    </article>
  );
}
