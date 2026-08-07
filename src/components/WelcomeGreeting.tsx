type WelcomeGreetingProps = {
  greeting: string;
  subtitle: string;
};

export function WelcomeGreeting({ greeting, subtitle }: WelcomeGreetingProps) {
  return (
    <section className="welcome-greeting" aria-live="polite">
      <p className="welcome-greeting__subtitle">{subtitle}</p>
      <p className="welcome-greeting__message">{greeting}</p>
    </section>
  );
}
