import { useEffect, useState } from "react";
import { Snowflake } from "lucide-react";
import type { HomeClimate } from "../../../shared/models";
import { homeService } from "../../services/homeService";
import { DeviceState } from "./DeviceState";

export function ClimateCard({
  climate,
  busy,
  run,
}: {
  climate: HomeClimate;
  busy: boolean;
  run: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const [temperature, setTemperature] = useState(
    climate.targetTemperature ?? climate.minTemperature,
  );
  useEffect(() => {
    setTemperature(climate.targetTemperature ?? climate.minTemperature);
  }, [climate]);
  const disabled = busy || !climate.available;
  return (
    <article className="home-device-card home-device-card--wide">
      <header className="home-device-card__header">
        <span className="home-device-card__icon home-device-card__icon--climate">
          <Snowflake aria-hidden="true" />
        </span>
        <div>
          <h3>{climate.name}</h3>
          <DeviceState available={climate.available} state={climate.state} />
        </div>
        <div className="home-temperature-now">
          <strong>{climate.currentTemperature ?? "—"}°C</strong>
          <span>w pokoju</span>
        </div>
      </header>
      <div className="home-power-actions">
        <button
          className="primary-button"
          disabled={disabled}
          onClick={() => void run(() => homeService.acPower(true))}
          type="button"
        >
          Włącz
        </button>
        <button
          className="secondary-button"
          disabled={disabled}
          onClick={() => void run(() => homeService.acPower(false))}
          type="button"
        >
          Wyłącz
        </button>
      </div>
      <div className="home-control-grid">
        <div className="home-range home-range--temperature">
          <span>
            Temperatura docelowa <strong>{temperature}°C</strong>
          </span>
          <input
            disabled={disabled}
            max={climate.maxTemperature}
            min={climate.minTemperature}
            onChange={(event) => setTemperature(Number(event.target.value))}
            step={climate.temperatureStep}
            type="range"
            value={temperature}
          />
          <button
            className="ghost-button"
            disabled={disabled}
            onClick={() =>
              void run(() => homeService.acTemperature(temperature))
            }
            type="button"
          >
            Ustaw
          </button>
        </div>
        {climate.modes.length ? (
          <label className="field">
            <span className="field__label">Tryb</span>
            <select
              className="field__input"
              disabled={disabled}
              onChange={(event) =>
                void run(() => homeService.acMode(event.target.value))
              }
              value={climate.state}
            >
              {climate.modes.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {climate.fanModes.length ? (
          <label className="field">
            <span className="field__label">Nawiew</span>
            <select
              className="field__input"
              disabled={disabled}
              onChange={(event) =>
                void run(() => homeService.acFan(event.target.value))
              }
              value={climate.fanMode ?? ""}
            >
              {climate.fanModes.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {climate.swingModes.length ? (
          <label className="field">
            <span className="field__label">Ruch żaluzji</span>
            <select
              className="field__input"
              disabled={disabled}
              onChange={(event) =>
                void run(() => homeService.acSwing(event.target.value))
              }
              value={climate.swingMode ?? ""}
            >
              {climate.swingModes.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    </article>
  );
}
