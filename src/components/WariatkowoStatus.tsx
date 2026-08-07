type WariatkowoStatusProps = {
  status: string;
};

export function WariatkowoStatus({ status }: WariatkowoStatusProps) {
  return (
    <p className="wariatkowo-status" aria-live="polite">
      {status}
    </p>
  );
}
