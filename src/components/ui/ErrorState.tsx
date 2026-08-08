type ErrorStateProps = {
  title: string;
  description: string;
  onRetry?: () => void;
  retryLabel?: string;
};

export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel = "Spróbuj ponownie",
}: ErrorStateProps) {
  return (
    <div className="state state--error" role="alert">
      <p className="state__title">{title}</p>
      <p className="state__description">{description}</p>
      {onRetry ? (
        <button className="state__retry" onClick={onRetry} type="button">
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
