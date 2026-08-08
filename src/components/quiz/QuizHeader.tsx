type QuizHeaderProps = {
  currentQuestionNumber: number;
  totalQuestions: number;
  score: number;
  maxScore: number;
  progressPercent: number;
};

export function QuizHeader({ currentQuestionNumber, totalQuestions, score, maxScore, progressPercent }: QuizHeaderProps) {
  return (
    <header className="quiz-header">
      <div className="quiz-header__copy">
        <p className="quiz-header__eyebrow">Powrót do Wariatkowa</p>
        <div className="quiz-header__meta">
          <p className="quiz-header__question-count">Pytanie {currentQuestionNumber} / {totalQuestions}</p>
          <p className="quiz-header__score">⭐ {score} pkt</p>
        </div>
      </div>

      <div className="quiz-header__progress">
        <div className="quiz-header__progress-track" aria-hidden="true">
          <span className="quiz-header__progress-fill" style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }} />
        </div>
        <p className="quiz-header__progress-label">Max {maxScore} pkt</p>
      </div>
    </header>
  );
}
