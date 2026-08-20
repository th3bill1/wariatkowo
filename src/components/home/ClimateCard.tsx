import { useEffect, useRef, useState } from "react";
import { Snowflake } from "lucide-react";
import type { HomeClimate } from "../../../shared/models";
import { homeService } from "../../services/homeService";
import { DeviceState } from "./DeviceState";

const OPTION_LABELS: Record<string, string> = {
  off: "Wyłączony",
  fan_only: "Nawiew",
  heat: "Grzanie",
  cool: "Chłodzenie",
  dry: "Osuszanie",
  auto: "Automatyczny",
  low: "Niski",
  middle_low: "Średnio niski",
  medium: "Średni",
  middle_high: "Średnio wysoki",
  high: "Wysoki",
  swing: "Wachlowanie",
  top: "Góra",
  mid_high: "Średnio wysoko",
  mid_low: "Średnio nisko",
  bottom: "Dół",
  both_sides: "Obie strony",
  left: "Lewo",
  forward: "Na wprost",
  right: "Prawo",
  general: "Ogólny",
  for_old: "Dla seniora",
  for_young: "Dla dorosłych",
  for_kid: "Dla dziecka",
};

function optionLabel(value: string): string {
  return OPTION_LABELS[value] ?? value.replaceAll("_", " ");
}

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
  const [numberValues, setNumberValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      climate.numbers.map((control) => [
        control.id,
        control.value ?? control.min,
      ]),
    ),
  );
  const runRef = useRef(run);
  const temperatureTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    runRef.current = run;
  }, [run]);
  useEffect(
    () => () => {
      window.clearTimeout(temperatureTimer.current);
    },
    [],
  );
  useEffect(() => {
    setTemperature(climate.targetTemperature ?? climate.minTemperature);
    setNumberValues(
      Object.fromEntries(
        climate.numbers.map((control) => [
          control.id,
          control.value ?? control.min,
        ]),
      ),
    );
  }, [climate]);

  const disabled = busy || !climate.available;
  const isOn = climate.available && climate.state !== "off";
  const hasExtraControls =
    climate.switches.length > 0 ||
    climate.selects.length > 0 ||
    climate.numbers.length > 0;

  const changeTemperature = (value: number) => {
    setTemperature(value);
    window.clearTimeout(temperatureTimer.current);
    temperatureTimer.current = window.setTimeout(() => {
      temperatureTimer.current = undefined;
      void runRef.current(() => homeService.acTemperature(value));
    }, 350);
  };

  return (
    <article className="home-device-card home-device-card--wide">
      <header className="home-device-card__header">
        <button
          aria-label={isOn ? "Wyłącz klimatyzację" : "Włącz klimatyzację"}
          aria-pressed={isOn}
          className={`home-device-card__icon home-device-card__icon--climate home-climate-power-toggle${isOn ? " home-climate-power-toggle--on" : ""}`}
          disabled={disabled}
          onClick={() => void run(() => homeService.acPower(!isOn))}
          type="button"
        >
          <Snowflake aria-hidden="true" />
        </button>
        <div>
          <h3>{climate.name}</h3>
          <DeviceState
            available={climate.available}
            label={optionLabel(climate.state)}
            state={climate.state}
          />
        </div>
        <div className="home-temperature-now">
          <strong>{climate.currentTemperature ?? "—"}°C</strong>
          <span>w pokoju</span>
        </div>
      </header>

      <div className="home-control-grid home-control-grid--climate">
        <div className="home-range home-range--temperature">
          <span>
            Temperatura docelowa <strong>{temperature}°C</strong>
          </span>
          <input
            disabled={disabled}
            max={climate.maxTemperature}
            min={climate.minTemperature}
            onChange={(event) => changeTemperature(Number(event.target.value))}
            step={climate.temperatureStep}
            type="range"
            value={temperature}
          />
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
                  {optionLabel(mode)}
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
                  {optionLabel(mode)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {climate.swingModes.length ? (
          <label className="field">
            <span className="field__label">Żaluzja pionowa</span>
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
                  {optionLabel(mode)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {climate.horizontalSwingModes.length ? (
          <label className="field">
            <span className="field__label">Żaluzja pozioma</span>
            <select
              className="field__input"
              disabled={disabled}
              onChange={(event) =>
                void run(() =>
                  homeService.acHorizontalSwing(event.target.value),
                )
              }
              value={climate.horizontalSwingMode ?? ""}
            >
              {climate.horizontalSwingModes.map((mode) => (
                <option key={mode} value={mode}>
                  {optionLabel(mode)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {hasExtraControls ? (
        <section className="home-climate-extras">
          <h4>Funkcje dodatkowe</h4>

          {climate.switches.length ? (
            <div className="home-climate-toggles">
              {climate.switches.map((control) => {
                const enabled = control.state === "on";
                return (
                  <button
                    aria-checked={enabled}
                    className={`home-climate-toggle${enabled ? " home-climate-toggle--active" : ""}`}
                    disabled={busy || !control.available}
                    key={control.id}
                    onClick={() =>
                      void run(() => homeService.acSwitch(control.id, !enabled))
                    }
                    role="switch"
                    type="button"
                  >
                    <span>{control.name}</span>
                    <strong>{enabled ? "Wł." : "Wył."}</strong>
                  </button>
                );
              })}
            </div>
          ) : null}

          {climate.selects.length || climate.numbers.length ? (
            <div className="home-climate-extra-fields">
              {climate.selects.map((control) => (
                <label className="field" key={control.id}>
                  <span className="field__label">{control.name}</span>
                  <select
                    className="field__input"
                    disabled={busy || !control.available}
                    onChange={(event) =>
                      void run(() =>
                        homeService.acSelect(control.id, event.target.value),
                      )
                    }
                    value={control.value ?? ""}
                  >
                    {control.options.map((option) => (
                      <option key={option} value={option}>
                        {optionLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}

              {climate.numbers.map((control) => {
                const value =
                  numberValues[control.id] ?? control.value ?? control.min;
                return (
                  <div className="home-range" key={control.id}>
                    <span>
                      {control.name}
                      <strong>
                        {value}
                        {control.unit ?? ""}
                      </strong>
                    </span>
                    <input
                      disabled={busy || !control.available}
                      max={control.max}
                      min={control.min}
                      onChange={(event) =>
                        setNumberValues((current) => ({
                          ...current,
                          [control.id]: Number(event.target.value),
                        }))
                      }
                      step={control.step}
                      type="range"
                      value={value}
                    />
                    <button
                      className="ghost-button"
                      disabled={busy || !control.available}
                      onClick={() =>
                        void run(() => homeService.acNumber(control.id, value))
                      }
                      type="button"
                    >
                      Ustaw
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>
      ) : null}
    </article>
  );
}
