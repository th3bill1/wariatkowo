import { useMemo } from "react";
import { DOODLES } from "../content/doodles";
import { useDesktopOnly } from "../hooks/useDesktopOnly";
import { usePointerParallax } from "../hooks/usePointerParallax";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { Doodle } from "./Doodle";

type FloatingDoodlesProps = {
  totalChaos: boolean;
};

export function FloatingDoodles({ totalChaos }: FloatingDoodlesProps) {
  const reducedMotion = usePrefersReducedMotion();
  const isDesktop = useDesktopOnly();
  const parallaxEnabled = isDesktop && !reducedMotion;
  const { containerRef, handlePointerMove, handlePointerLeave } =
    usePointerParallax<HTMLDivElement>(parallaxEnabled);

  const doodles = useMemo(() => DOODLES, []);

  return (
    <div
      className="floating-doodles"
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      ref={containerRef}
    >
      {doodles.map((placement) => (
        <Doodle
          key={placement.id}
          onDogClick={() => undefined}
          parallaxEnabled={parallaxEnabled}
          placement={placement}
          reducedMotion={reducedMotion}
          totalChaos={totalChaos}
        />
      ))}
    </div>
  );
}
