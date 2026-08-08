import { WELCOME_COPY } from "../content/welcome";

type WelcomeCTAProps = {
  onClick: () => void;
  isExiting: boolean;
};

export function WelcomeCTA({ onClick, isExiting }: WelcomeCTAProps) {
  return (
    <button
      className={["welcome-cta", isExiting ? "welcome-cta--exiting" : ""].join(
        " ",
      )}
      onClick={onClick}
      type="button"
    >
      <span className="welcome-cta__text">{WELCOME_COPY.cta}</span>
    </button>
  );
}
