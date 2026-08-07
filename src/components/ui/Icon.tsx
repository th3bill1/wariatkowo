type IconName = 'home' | 'tasks' | 'shopping' | 'spark';

type IconProps = {
  name: IconName;
  className?: string;
};

export function Icon({ name, className }: IconProps) {
  if (name === 'home') {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
        <path d="M4 11.5 12 5l8 6.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        <path d="M7 10.75V19h10v-8.25" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        <path d="M10 19v-5h4v5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    );
  }

  if (name === 'tasks') {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
        <path d="M8 7h11" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        <path d="M8 12h11" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        <path d="M8 17h11" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        <path d="m4.5 6.5 1 1 1.7-1.8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        <path d="m4.5 11.5 1 1 1.7-1.8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        <path d="m4.5 16.5 1 1 1.7-1.8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    );
  }

  if (name === 'shopping') {
    return (
      <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
        <path d="M6 8h13l-1.4 7.5a2 2 0 0 1-2 1.6H9a2 2 0 0 1-2-1.6L5.5 5.5H3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        <path d="M9 20a1 1 0 1 0 0-.01V20Zm8 0a1 1 0 1 0 0-.01V20Z" fill="currentColor" />
        <path d="m9 6 .7-2.2A1 1 0 0 1 10.6 3h1.8a1 1 0 0 1 .9.8L14 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M12 3 14.8 8.9 21 9.8l-4.5 4.4 1.1 6.2L12 17.3 6.4 20.4l1.1-6.2L3 9.8l6.2-.9L12 3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}
