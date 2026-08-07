type LoadingStateProps = {
  label: string;
};

export function LoadingState({ label }: LoadingStateProps) {
  return (
    <div className="state state--loading" aria-live="polite">
      <span className="state__spinner" aria-hidden="true" />
      <p className="state__description">{label}</p>
    </div>
  );
}
