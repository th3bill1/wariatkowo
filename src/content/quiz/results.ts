export type QuizResultMessage = {
  minPercent: number;
  message: string;
};

export const quizResultMessages: QuizResultMessage[] = [
  {
    minPercent: 90,
    message: 'Honorowa obywatelka Wariatkowa 👑',
  },
  {
    minPercent: 70,
    message: 'Coś tam pamiętasz, ale musisz zostać na dłużej.',
  },
  {
    minPercent: 40,
    message: 'Długa podróż zrobiła swoje.',
  },
  {
    minPercent: 0,
    message: 'Kim jesteś i co zrobiłaś z moją dziewczyną?',
  },
];

export function getQuizResultMessage(percent: number): QuizResultMessage {
  return quizResultMessages.find((result) => percent >= result.minPercent) ?? quizResultMessages[quizResultMessages.length - 1];
}
