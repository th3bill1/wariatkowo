import { Link } from 'react-router-dom';

type QuizResultProps = {
  score: number;
  maxScore: number;
  percentage: number;
  message: string;
  onRestart: () => void;
};

export function QuizResult({ score, maxScore, percentage, message, onRestart }: QuizResultProps) {
  return (
    <section className="quiz-result">
      <p className="quiz-result__eyebrow">Wynik końcowy</p>
      <h2 className="quiz-result__title">{message}</h2>
      <p className="quiz-result__score">{score} / {maxScore} pkt</p>
      <p className="quiz-result__percentage">{percentage}% poprawnych punktów</p>
      <div className="quiz-result__actions">
        <button className="quiz-choice-button quiz-choice-button--primary quiz-result__restart" type="button" onClick={onRestart}>
          Zagraj jeszcze raz
        </button>
        <Link className="quiz-result__back-link" to="/dashboard">
          ← Wróć do Wariatkowa
        </Link>
      </div>
    </section>
  );
}
