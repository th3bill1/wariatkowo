import { useState } from "react";
import type { QuizQuestion } from "../../content/quiz/questions";

type QuestionStage = "waiting" | "self-answer" | "multiple-choice" | "answered";

type QuestionEvaluation = {
  status: "none" | "correct" | "incorrect";
  selectedAnswerIndex: number | null;
  pointsAwarded: 0 | 1 | 2;
};

type QuestionCardProps = {
  question: QuizQuestion;
  stage: QuestionStage;
  evaluation: QuestionEvaluation;
  onChooseSelfAnswer: () => void;
  onChooseMultipleChoice: () => void;
  onEvaluateSelfAnswer: (isCorrect: boolean) => void;
  onChooseAnswer: (answerIndex: number) => void;
  onNextQuestion: () => void;
  prefersReducedMotion: boolean;
};

function getAnswerClassName(params: {
  index: number;
  stage: QuestionStage;
  evaluation: QuestionEvaluation;
  correctAnswerIndex: number;
}): string {
  const { index, stage, evaluation, correctAnswerIndex } = params;
  const classNames = ["quiz-answer"];

  if (stage !== "multiple-choice" && stage !== "answered") {
    return classNames.join(" ");
  }

  if (evaluation.status !== "none") {
    if (index === correctAnswerIndex) {
      classNames.push("quiz-answer--correct");
    }

    if (
      evaluation.status === "incorrect" &&
      evaluation.selectedAnswerIndex === index
    ) {
      classNames.push("quiz-answer--wrong");
    }

    if (
      evaluation.status === "correct" &&
      evaluation.selectedAnswerIndex === index
    ) {
      classNames.push("quiz-answer--selected");
    }

    classNames.push("quiz-answer--locked");
  }

  return classNames.join(" ");
}

export function QuestionCard({
  question,
  stage,
  evaluation,
  onChooseSelfAnswer,
  onChooseMultipleChoice,
  onEvaluateSelfAnswer,
  onChooseAnswer,
  onNextQuestion,
  prefersReducedMotion,
}: QuestionCardProps) {
  const [hasImageError, setHasImageError] = useState(false);
  const isResolved = stage === "answered";
  const correctAnswerText = question.answers[question.correctAnswer];
  const feedbackCopy =
    evaluation.status === "correct"
      ? `Dobrze! +${evaluation.pointsAwarded} pkt`
      : evaluation.status === "incorrect"
        ? "Niestety nie."
        : "";

  return (
    <section
      className={[
        "quiz-question",
        prefersReducedMotion ? "quiz-question--calm" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="quiz-question__media">
        {hasImageError ? (
          <div className="quiz-question__placeholder">
            <p>Tu miało być zdjęcie z Wariatkowa</p>
          </div>
        ) : (
          <img
            alt={question.imageAlt ?? question.question}
            className="quiz-question__image"
            src={question.image}
            onError={() => setHasImageError(true)}
          />
        )}
      </div>

      <div className="quiz-question__body">
        <p className="quiz-question__label">
          {isResolved ? "Odpowiedź sprawdzona" : "Quiz"}
        </p>
        <h2 className="quiz-question__title">{question.question}</h2>

        {stage === "waiting" ? (
          <div className="quiz-choice-grid">
            <button
              className="quiz-choice-button quiz-choice-button--primary"
              type="button"
              onClick={onChooseSelfAnswer}
            >
              Wiem bez podpowiedzi
            </button>
            <button
              className="quiz-choice-button"
              type="button"
              onClick={onChooseMultipleChoice}
            >
              Pokaż odpowiedzi
            </button>
          </div>
        ) : null}

        {stage === "self-answer" ? (
          <div className="quiz-host-panel">
            <p className="quiz-host-panel__copy">Odpowiedz bez podpowiedzi.</p>
            <div className="quiz-host-panel__actions">
              <button
                className="quiz-choice-button quiz-choice-button--primary quiz-choice-button--large"
                type="button"
                onClick={() => onEvaluateSelfAnswer(true)}
              >
                Dobrze +2
              </button>
              <button
                className="quiz-choice-button quiz-choice-button--danger quiz-choice-button--large"
                type="button"
                onClick={() => onEvaluateSelfAnswer(false)}
              >
                Źle
              </button>
            </div>
          </div>
        ) : null}

        {stage === "multiple-choice" ||
        (stage === "answered" && evaluation.selectedAnswerIndex !== null) ? (
          <div
            className="quiz-answers"
            role="list"
            aria-label="Możliwe odpowiedzi"
          >
            {question.answers.map((answer, index) => {
              const isSelected = evaluation.selectedAnswerIndex === index;
              const buttonClassName = getAnswerClassName({
                index,
                stage,
                evaluation,
                correctAnswerIndex: question.correctAnswer,
              });

              return (
                <button
                  key={answer}
                  className={buttonClassName}
                  type="button"
                  onClick={() => onChooseAnswer(index)}
                  disabled={
                    stage === "answered" || evaluation.status !== "none"
                  }
                  aria-pressed={isSelected}
                >
                  <span className="quiz-answer__letter">
                    {String.fromCharCode(65 + index)}.
                  </span>
                  <span className="quiz-answer__text">{answer}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {stage === "answered" ? (
          <div className="quiz-feedback">
            <p
              className={`quiz-feedback__title quiz-feedback__title--${evaluation.status}`}
            >
              {feedbackCopy}
            </p>
            {evaluation.pointsAwarded > 0 ? (
              <p className="quiz-feedback__points">
                +{evaluation.pointsAwarded} pkt
              </p>
            ) : null}
            {evaluation.status === "incorrect" ? (
              <p className="quiz-feedback__answer">
                Poprawna odpowiedź: {correctAnswerText}
              </p>
            ) : null}
            <button
              className="quiz-next-button"
              type="button"
              onClick={onNextQuestion}
            >
              Następne pytanie
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
