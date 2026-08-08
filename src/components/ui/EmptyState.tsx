import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="state state--empty">
      <p className="state__title">{title}</p>
      <p className="state__description">{description}</p>
      {action ? <div className="state__action">{action}</div> : null}
    </div>
  );
}
