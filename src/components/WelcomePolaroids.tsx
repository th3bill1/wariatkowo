import { useState, type CSSProperties } from "react";
import { POLAROID_PHOTOS } from "../content/polaroids";
import { useDesktopOnly } from "../hooks/useDesktopOnly";
import { usePointerParallax } from "../hooks/usePointerParallax";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { randomRotation, randomUniqueItems } from "../utils/randomSelection";
import { PolaroidPhoto } from "./PolaroidPhoto";

export function WelcomePolaroids({ totalChaos }: { totalChaos: boolean }) {
  const reducedMotion = usePrefersReducedMotion(),
    desktop = useDesktopOnly();
  const parallax = desktop && !reducedMotion;
  const { containerRef, handlePointerMove, handlePointerLeave } =
    usePointerParallax<HTMLDivElement>(parallax);
  const [photos] = useState(() =>
    randomUniqueItems(POLAROID_PHOTOS, 6).map((photo, index) => ({
      ...photo,
      rotation: randomRotation(),
      depth: 0.25 + (index % 3) * 0.12,
    })),
  );
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
