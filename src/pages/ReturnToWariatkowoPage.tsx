import { useMemo, useReducer } from 'react';
import { Link } from 'react-router-dom';
import { AppCard } from '../components/ui/AppCard';
import { PageHeader } from '../components/ui/PageHeader';
import { QuestionCard } from '../components/quiz/QuestionCard';
import { QuizHeader } from '../components/quiz/QuizHeader';
import { QuizResult } from '../components/quiz/QuizResult';
import { quizQuestionIssues, quizQuestions } from '../content/quiz/questions';
import { getQuizResultMessage } from '../content/quiz/results';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

type QuestionStage = 'waiting' | 'self-answer' | 'multiple-choice' | 'answered';

type QuestionEvaluation = {
  status: 'none' | 'correct' | 'incorrect';
  selectedAnswerIndex: number | null;
  pointsAwarded: 0 | 1 | 2;
};

type QuizState = {
  currentQuestionIndex: number;
  score: number;
  stage: QuestionStage;
  evaluation: QuestionEvaluation;
  completed: boolean;
};

type QuizAction =
  | { type: 'choose-self-answer' }
  | { type: 'choose-multiple-choice' }
  | { type: 'evaluate-self-answer'; isCorrect: boolean }
  | { type: 'choose-answer'; answerIndex: number }
  | { type: 'next-question' }
  | { type: 'restart' };

const initialState: QuizState = {
  currentQuestionIndex: 0,
  score: 0,
  stage: 'waiting',
  evaluation: {
    status: 'none',
    selectedAnswerIndex: null,
    pointsAwarded: 0,
  },
  completed: false,
};

function createResetEvaluation(): QuestionEvaluation {
  return {
    status: 'none',
    selectedAnswerIndex: null,
    pointsAwarded: 0,
  };
}

function quizReducer(state: QuizState, action: QuizAction): QuizState {
  if (state.completed && action.type !== 'restart') {
    return state;
  }

  switch (action.type) {
    case 'choose-self-answer':
      if (state.stage !== 'waiting') {
        return state;
      }

      return {
        ...state,
        stage: 'self-answer',
        evaluation: createResetEvaluation(),
      };
    case 'choose-multiple-choice':
      if (state.stage !== 'waiting') {
        return state;
      }

      return {
        ...state,
        stage: 'multiple-choice',
        evaluation: createResetEvaluation(),
      };
    case 'evaluate-self-answer':
      if (state.stage !== 'self-answer' || state.evaluation.status !== 'none') {
        return state;
      }

      return {
        ...state,
        score: state.score + (action.isCorrect ? 2 : 0),
        stage: 'answered',
        evaluation: {
          status: action.isCorrect ? 'correct' : 'incorrect',
          selectedAnswerIndex: null,
          pointsAwarded: action.isCorrect ? 2 : 0,
        },
      };
    case 'choose-answer': {
      if (state.stage !== 'multiple-choice' || state.evaluation.status !== 'none') {
        return state;
      }

      const correctAnswerIndex = quizQuestions[state.currentQuestionIndex].correctAnswer;
      const isCorrect = action.answerIndex === correctAnswerIndex;

      return {
        ...state,
        score: state.score + (isCorrect ? 1 : 0),
        stage: 'answered',
        evaluation: {
          status: isCorrect ? 'correct' : 'incorrect',
          selectedAnswerIndex: action.answerIndex,
          pointsAwarded: isCorrect ? 1 : 0,
        },
      };
    }
    case 'next-question': {
      if (state.stage !== 'answered') {
        return state;
      }

      const nextQuestionIndex = state.currentQuestionIndex + 1;
      if (nextQuestionIndex >= quizQuestions.length) {
        return {
          ...state,
          completed: true,
        };
      }

      return {
        ...state,
        currentQuestionIndex: nextQuestionIndex,
        stage: 'waiting',
        evaluation: createResetEvaluation(),
      };
    }
    case 'restart':
      return initialState;
    default:
      return state;
  }
}

export function ReturnToWariatkowoPage() {
  const reducedMotion = usePrefersReducedMotion();
  const [state, dispatch] = useReducer(quizReducer, initialState);
  const totalQuestions = quizQuestions.length;
  const maxScore = totalQuestions * 2;
  const currentQuestion = quizQuestions[state.currentQuestionIndex] ?? quizQuestions[0];
  const currentQuestionNumber = Math.min(state.currentQuestionIndex + 1, totalQuestions);
  const progressPercent = totalQuestions > 0 ? (currentQuestionNumber / totalQuestions) * 100 : 0;
  const percentageScore = maxScore > 0 ? Math.round((state.score / maxScore) * 100) : 0;
  const resultMessage = useMemo(() => getQuizResultMessage(percentageScore), [percentageScore]);

  if (quizQuestionIssues.length > 0) {
    return (
      <div className="quiz-page">
        <PageHeader
          eyebrow="Powrót do Wariatkowa"
          title="Quiz wymaga poprawki"
          description="Coś w konfiguracji pytań nie gra. Poniżej widać, co trzeba naprawić zanim quiz będzie gotowy."
          actions={<Link className="app-link-button" to="/dashboard">← Wróć do Wariatkowa</Link>}
        />
        <AppCard className="quiz-error-card">
          <p className="quiz-error-card__title">Problemy w konfiguracji:</p>
          <ul className="quiz-error-card__list">
            {quizQuestionIssues.map((issue, index) => (
              <li key={`${issue.id ?? 'quiz-issue'}-${index}`}>{issue.message}</li>
            ))}
          </ul>
        </AppCard>
      </div>
    );
  }

  return (
    <div className="quiz-page">
      <PageHeader
        eyebrow="Quiz"
        title="Powrót do Wariatkowa"
        description="Mini quiz dla Miśki, czy jeszcze cokolwiek pamięta o naszym domu."
      />

      <AppCard className="quiz-shell">
        {!state.completed ? (
          <>
            <QuizHeader
              currentQuestionNumber={currentQuestionNumber}
              maxScore={maxScore}
              progressPercent={progressPercent}
              score={state.score}
              totalQuestions={totalQuestions}
            />

            <QuestionCard
              key={currentQuestion.id}
              evaluation={state.evaluation}
              onChooseAnswer={(answerIndex) => dispatch({ type: 'choose-answer', answerIndex })}
              onChooseMultipleChoice={() => dispatch({ type: 'choose-multiple-choice' })}
              onChooseSelfAnswer={() => dispatch({ type: 'choose-self-answer' })}
              onEvaluateSelfAnswer={(isCorrect) => dispatch({ type: 'evaluate-self-answer', isCorrect })}
              onNextQuestion={() => dispatch({ type: 'next-question' })}
              prefersReducedMotion={reducedMotion}
              question={currentQuestion}
              stage={state.stage}
            />
          </>
        ) : (
          <QuizResult
            maxScore={maxScore}
            message={resultMessage.message}
            onRestart={() => dispatch({ type: 'restart' })}
            percentage={percentageScore}
            score={state.score}
          />
        )}
      </AppCard>

      <p className="quiz-page__footnote">Pamiętaj: po kliknięciu <strong>Pokaż odpowiedzi</strong> to pytanie daje maksymalnie 1 pkt.</p>
    </div>
  );
}
