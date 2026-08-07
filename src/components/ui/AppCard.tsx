import type { ReactNode } from 'react';

type AppCardProps = {
  children: ReactNode;
  className?: string;
};

export function AppCard({ children, className = '' }: AppCardProps) {
  return <section className={['app-card', className].filter(Boolean).join(' ')}>{children}</section>;
}
