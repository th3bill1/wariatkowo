import { Download, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import type { MobileReleaseStatus } from "../../shared/models";
import { mobileReleaseService } from "../services/mobileReleaseService";

export function MobileReleaseDownloadContent({
  release,
}: {
  release: MobileReleaseStatus;
}) {
  if (!release.available) return null;

  return (
    <section className="mobile-release" aria-label="Wariatkowo na Androida">
      <div className="mobile-release__copy">
        <Smartphone aria-hidden="true" />
        <div>
          <strong>Wariatkowo na Androida</strong>
          <span>
            v{release.version} · build {release.versionCode} ·{" "}
            {new Intl.DateTimeFormat("pl-PL", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            }).format(new Date(release.builtAt))}
          </span>
        </div>
      </div>
      <a
        className="mobile-release__download"
        href={release.downloadUrl}
        download
      >
        <Download aria-hidden="true" />
        Pobierz najnowszą wersję
      </a>
    </section>
  );
}

export function MobileReleaseDownload() {
  const [release, setRelease] = useState<MobileReleaseStatus | null>(null);

  useEffect(() => {
    let active = true;
    void mobileReleaseService
      .latest()
      .then((latest) => {
        if (active) setRelease(latest);
      })
      .catch(() => {
        if (active) setRelease(null);
      });
    return () => {
      active = false;
    };
  }, []);

  return release ? <MobileReleaseDownloadContent release={release} /> : null;
}
