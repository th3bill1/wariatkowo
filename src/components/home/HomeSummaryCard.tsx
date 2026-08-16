import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { HomeStatus } from "../../../shared/models";
import { homeService } from "../../services/homeService";
import { AppCard } from "../ui/AppCard";
import { SectionHeader } from "../ui/SectionHeader";

export function HomeSummaryCard() {
  const [status, setStatus] = useState<HomeStatus | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void homeService
      .status(controller.signal)
      .then(setStatus)
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  const lightCount =
    status?.lights.filter((light) => light.state === "on").length ?? 0;
  return (
    <AppCard className="dashboard-card dashboard-card--home">
      <SectionHeader
        title="Dom"
        description={
          status?.connected ? "Home Assistant połączony" : "Sterowanie domem"
        }
        actions={
          <Link className="app-link-button" to="/home">
            Otwórz →
          </Link>
        }
      />
      <ul className="home-summary-list">
        {status?.lights.length ? (
          <li>
            <strong>{lightCount}</strong> światła włączone
          </li>
        ) : null}
        {status?.ac?.currentTemperature != null ? (
          <li>
            <strong>{status.ac.currentTemperature}°C</strong> w mieszkaniu
          </li>
        ) : null}
        {status?.tv ? (
          <li>
            TV:{" "}
            <strong>
              {status.tv.state === "off" ? "wyłączony" : status.tv.state}
            </strong>
          </li>
        ) : null}
        {status?.xbox ? (
          <li>
            Xbox:{" "}
            <strong>
              {status.xbox.state === "off" ? "wyłączony" : status.xbox.state}
            </strong>
          </li>
        ) : null}
        {!status?.connected ? (
          <li className="home-summary-list__quiet">
            Urządzenia mogą być chwilowo offline.
          </li>
        ) : null}
      </ul>
    </AppCard>
  );
}
