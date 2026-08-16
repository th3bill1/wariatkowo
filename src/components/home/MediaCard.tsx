import { useEffect, useState } from "react";
import { Gamepad2, Tv } from "lucide-react";
import type { HomeMediaDevice } from "../../../shared/models";
import { homeService } from "../../services/homeService";
import { DeviceState } from "./DeviceState";

export function MediaCard({
  device,
  busy,
  run,
}: {
  device: HomeMediaDevice;
  busy: boolean;
  run: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const [volume, setVolume] = useState(device.volume ?? 20);
  useEffect(() => setVolume(device.volume ?? 20), [device.volume]);
  const disabled = busy || !device.available;
  const isTv = device.id === "tv";
  return (
    <article className="home-device-card">
      <header className="home-device-card__header">
        <span
          className={`home-device-card__icon home-device-card__icon--${device.id}`}
        >
          {isTv ? <Tv aria-hidden="true" /> : <Gamepad2 aria-hidden="true" />}
        </span>
        <div>
          <h3>{device.name}</h3>
          <DeviceState available={device.available} state={device.state} />
        </div>
      </header>
      {device.mediaTitle ? (
        <p className="home-media-title">
          Teraz: <strong>{device.mediaTitle}</strong>
        </p>
      ) : null}
      <div className="home-power-actions">
        <button
          className="primary-button"
          disabled={disabled}
          onClick={() =>
            void run(() => homeService.mediaPower(device.id, true))
          }
          type="button"
        >
          Włącz
        </button>
        <button
          className="secondary-button"
          disabled={disabled}
          onClick={() =>
            void run(() => homeService.mediaPower(device.id, false))
          }
          type="button"
        >
          Wyłącz
        </button>
      </div>
      {isTv && device.supportsVolume ? (
        <div className="home-range">
          <span>
            Głośność <strong>{volume}%</strong>
          </span>
          <input
            disabled={disabled}
            max="100"
            min="0"
            onChange={(event) => setVolume(Number(event.target.value))}
            type="range"
            value={volume}
          />
          <button
            className="ghost-button"
            disabled={disabled}
            onClick={() => void run(() => homeService.tvVolume(volume))}
            type="button"
          >
            Ustaw
          </button>
        </div>
      ) : null}
      {isTv && device.supportsMute ? (
        <button
          className="ghost-button home-save-button"
          disabled={disabled}
          onClick={() => void run(() => homeService.tvMute(!device.muted))}
          type="button"
        >
          {device.muted ? "Włącz dźwięk" : "Wycisz"}
        </button>
      ) : null}
      {isTv && device.supportsSource ? (
        <label className="field">
          <span className="field__label">Źródło</span>
          <select
            className="field__input"
            disabled={disabled}
            onChange={(event) =>
              void run(() => homeService.tvSource(event.target.value))
            }
            value={device.source ?? ""}
          >
            {device.sources.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {isTv && device.supportsCommands ? (
        <div className="home-remote" aria-label="Pilot telewizora">
          {[
            ["Dom", "KEY_HOME"],
            ["←", "KEY_LEFT"],
            ["OK", "KEY_ENTER"],
            ["→", "KEY_RIGHT"],
            ["Wstecz", "KEY_RETURN"],
          ].map(([label, command]) => (
            <button
              disabled={disabled}
              key={command}
              onClick={() => void run(() => homeService.tvCommand(command))}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}
