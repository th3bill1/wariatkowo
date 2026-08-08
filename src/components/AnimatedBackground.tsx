import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

type AnimatedBackgroundProps = {
  totalChaos: boolean;
};

export function AnimatedBackground({ totalChaos }: AnimatedBackgroundProps) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div
      className={[
        "animated-background",
        totalChaos ? "animated-background--chaos" : "",
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className="animated-background__blob animated-background__blob--one"
      />
      <span
        aria-hidden="true"
        className="animated-background__blob animated-background__blob--two"
      />
      <span
        aria-hidden="true"
        className="animated-background__blob animated-background__blob--three"
      />
      <span
        aria-hidden="true"
        className="animated-background__blob animated-background__blob--four"
      />
      {reducedMotion ? null : (
        <span aria-hidden="true" className="animated-background__grain" />
      )}
    </div>
  );
}
