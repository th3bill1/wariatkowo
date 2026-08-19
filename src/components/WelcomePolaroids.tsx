import { useMemo, type CSSProperties } from "react";
import { useDesktopOnly } from "../hooks/useDesktopOnly";
import { usePointerParallax } from "../hooks/usePointerParallax";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { usePolaroidPhotos } from "../hooks/usePolaroidPhotos";
import { randomUniqueItems } from "../utils/randomSelection";
import { PolaroidPhoto } from "./PolaroidPhoto";

const WELCOME_POLAROID_ROTATIONS = [-7, 4.5, -3.5, 6, -5.25, 2.75];

export function WelcomePolaroids({ totalChaos }: { totalChaos: boolean }) {
  const availablePhotos = usePolaroidPhotos();
  const reducedMotion = usePrefersReducedMotion(),
    desktop = useDesktopOnly();
  const parallax = desktop && !reducedMotion;
  const { containerRef, handlePointerMove, handlePointerLeave } =
    usePointerParallax<HTMLDivElement>(parallax);
  const photos = useMemo(
    () =>
      randomUniqueItems(availablePhotos, 6).map((photo, index) => ({
        ...photo,
        rotation: WELCOME_POLAROID_ROTATIONS[index],
        depth: 0.25 + (index % 3) * 0.12,
      })),
    [availablePhotos],
  );
  if (!photos.length) return null;

  return (
    <div
      aria-hidden="true"
      className={[
        "welcome-polaroids",
        reducedMotion ? "welcome-polaroids--reduced" : "",
        totalChaos ? "welcome-polaroids--chaos" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      ref={containerRef}
    >
      {photos.map((photo, index) => (
        <PolaroidPhoto
          className={`welcome-polaroid welcome-polaroid--${index + 1}`}
          key={photo.src}
          position={photo.position}
          rotation={photo.rotation}
          size={index < 2 ? "large" : "medium"}
          src={photo.src}
          style={{ "--photo-depth": photo.depth } as CSSProperties}
        />
      ))}
    </div>
  );
}
