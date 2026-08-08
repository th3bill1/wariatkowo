/*
How to add a question:

1. Copy the image to public/quiz/
2. Add a new object to quizQuestions below
3. Set image to "/quiz/my-image.webp" or another supported format
4. Replace the placeholder answers with real ones
5. Set correctAnswer to the zero-based index of the right answer
*/

export type QuizQuestion = {
  id: string;
  question: string;
  image: string;
  imageAlt?: string;
  answers: [string, string, string, string];
  correctAnswer: number;
};

export const quizQuestions: QuizQuestion[] = [
  {
    id: 'sniadanie',
    question: 'Co tradycyjnie jemy w każdą niedzielę na śniadanie?',
    image: '/quiz/balkon.jpg',
    imageAlt: 'sniadanie',
    answers: ['Szakszuke','Omleta','Naleśniki','Bajgle'],
    correctAnswer: 0
  },
  {
    id: 'osiedle',
    question: 'Jak nazywa się nasze osiedle?',
    image: '/quiz/osiedle.jpg',
    imageAlt: 'Widok naszego osiedla',
    answers: ['In Place', 'Active City', 'Active Home', 'Smart City'],
    correctAnswer: 1,
  },
  {
    id: 'snack',
    question: 'Jaki jest ulubiony snack Miśków?',
    image: '/quiz/snack.jpg',
    imageAlt: 'Snack',
    answers: ['Strongi','Orzeszki','Arbuz','Lody'],
    correctAnswer: 0
  },
  {
    id: 'klima',
    question: 'Jak nazywamy klimatyzację w Wariatkowie (dopóki Miśka nie wymyśli lepszej nazwy)?',
    image: '/quiz/klima.jpg',
    imageAlt: 'Klima',
    answers: ['Chłodzownica','Wietrzyciel','Dmuchator','Szumownica'],
    correctAnswer: 3
  },
  {
    id: 'przeprowadzka',
    question: 'Kiedy przeprowadziliśmy się do Wariatkowa?',
    image: '/quiz/przeprowadzka2.jpeg',
    imageAlt: 'Zdjęcie z przeprowadzki do Wariatkowa',
    answers: ['26 lutego', '20 lutego', '27 lutego', '1 marca'],
    correctAnswer: 2,
  },
  {
    id: 'samotnosc',
    question: 'Ile razy Misiek został osamotniony w Wariatkowie?',
    image: '/quiz/hot.jpg',
    imageAlt: 'Hot',
    answers: ['2','3','4','5'],
    correctAnswer: 2
  },
  {
    id: 'jedzenie',
    question: 'Jakie było pierwsze jedzenie, które zjedliśmy w Wariatkowie?',
    image: '/quiz/jedzenie.jpg',
    imageAlt: 'Jedzenie',
    answers: ['Azjata', 'Pizza', 'Szakszuka', 'Arrabbiata'],
    correctAnswer: 1,
  },
  {
    id: 'ludzie',
    question: 'Ilu osobom (znajomi, rodzina) było dane zagościć w Wariatkowie?',
    image: '/quiz/parapetówka.jpg',
    imageAlt: 'Goście',
    answers: ['16', '21', '24', '27'],
    correctAnswer: 2,
  },
  {
    id: 'cechy',
    question: 'Który zestaw najlepiej oddaje czym jest Wariatkowo?',
    image: '/quiz/szalona.jpg',
    imageAlt: 'Wariatkowo',
    answers: ['piękne, spokojne, bezpieczne, zabawne', 
              'wesołe, luźne, ciche, kochające',
              'przyjemne, pyszne, ciekawe, nudne',
              'pełne miłości, zagracone, śmiszne, szalone'],
    correctAnswer: 3
  },
  {
    id: 'noc',
    question: 'Dlaczego sąsiedzi narzekają, że w nocy jest u nas głośno?',
    image: '/quiz/jeki.png',
    imageAlt: 'Jęki',
    answers: ['bo Miśka głośno chrapie', 'bo Misiek krzyczy na komputer', 'Wcale nie jest głośno', 'bo słychać głośne jęki'],
    correctAnswer: 3,
  },

];

export type QuizConfigIssue = {
  id?: string;
  message: string;
};

export function validateQuizQuestions(questions: readonly QuizQuestion[]): QuizConfigIssue[] {
  const issues: QuizConfigIssue[] = [];
  const ids = new Set<string>();

  questions.forEach((question, index) => {
    const label = question.id || `question-${index + 1}`;

    if (!question.id.trim()) {
      issues.push({ id: label, message: `Pytanie ${index + 1}: brakuje id.` });
    } else if (ids.has(question.id)) {
      issues.push({ id: question.id, message: `Pytanie ${index + 1}: duplikat id "${question.id}".` });
    } else {
      ids.add(question.id);
    }

    if (!question.question.trim()) {
      issues.push({ id: label, message: `Pytanie ${index + 1}: treść pytania nie może być pusta.` });
    }

    if (!question.image.trim()) {
      issues.push({ id: label, message: `Pytanie ${index + 1}: ścieżka obrazka nie może być pusta.` });
    } else if (!/^\/quiz\/[^\s]+\.(webp|jpe?g|png)$/i.test(question.image)) {
      issues.push({ id: label, message: `Pytanie ${index + 1}: image powinno wskazywać na plik w public/quiz/ i mieć rozszerzenie webp/jpg/jpeg/png.` });
    }

    if (question.answers.length !== 4) {
      issues.push({ id: label, message: `Pytanie ${index + 1}: musi mieć dokładnie 4 odpowiedzi.` });
    }

    if (!Number.isInteger(question.correctAnswer) || question.correctAnswer < 0 || question.correctAnswer > 3) {
      issues.push({ id: label, message: `Pytanie ${index + 1}: correctAnswer musi być liczbą od 0 do 3.` });
    }

    if (question.answers.some((answer) => !answer.trim())) {
      issues.push({ id: label, message: `Pytanie ${index + 1}: wszystkie odpowiedzi powinny być niepuste.` });
    }
  });

  if (questions.length === 0) {
    issues.push({ message: 'Brak pytań w quizie.' });
  }

  return issues;
}

export const quizQuestionIssues = validateQuizQuestions(quizQuestions);
