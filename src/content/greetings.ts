export type GreetingContext = {
  isReturning: boolean;
  hour: number;
};

export const FIRST_VISIT_GREETINGS = [
  'Witamy w Wariatkowie.',
  'Seksowne Miśki witają!',
] as const;

export const RETURNING_GREETINGS = [
  'Witamy ponownie 😎',
  'No w końcu tu jesteś...',
] as const;

export const TIME_BASED_GREETINGS = {
  morning: 'Dzień dobry ❤️',
  evening: 'Dobry wieczór ❤️',
  night: 'Idź spać.',
} as const;

export function pickGreeting(context: GreetingContext): string {
  if (!context.isReturning) {
    return FIRST_VISIT_GREETINGS[0];
  }

  if (context.hour >= 5 && context.hour < 12) {
    return TIME_BASED_GREETINGS.morning;
  }

  if (context.hour >= 12 && context.hour < 18) {
    return RETURNING_GREETINGS[1];
  }

  if (context.hour >= 18 && context.hour < 23) {
    return TIME_BASED_GREETINGS.evening;
  }

  return TIME_BASED_GREETINGS.night;
}
