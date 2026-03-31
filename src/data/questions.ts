import eikenGrade4Json from './questionSets/eiken/grade4.json';
import eikenGrade5Json from './questionSets/eiken/grade5.json';
import eikenGradePre1Json from './questionSets/eiken/gradepre1.json';

export type Question = {
  text: string;
  translation: string;
};

export type DifficultyKey = 'Eiken5' | 'Eiken4' | 'EikenPre1';
export type LevelKey = 1 | 2 | 3;
export type QuestionSetFile = {
  category: string;
  series: string;
  difficultyKey: DifficultyKey;
  displayName: string;
  levels: Record<string, Question[]>;
};

const questionSetLibrary = {
  eiken: {
    grade5: eikenGrade5Json as QuestionSetFile,
    grade4: eikenGrade4Json as QuestionSetFile,
    gradepre1: eikenGradePre1Json as QuestionSetFile,
  },
  toeic: {},
  conversation: {},
} satisfies {
  eiken: Record<string, QuestionSetFile>;
  toeic: Record<string, QuestionSetFile>;
  conversation: Record<string, QuestionSetFile>;
};

const toLevelRecord = (setFile: QuestionSetFile): Record<LevelKey, Question[]> => ({
  1: setFile.levels['1'] ?? [],
  2: setFile.levels['2'] ?? [],
  3: setFile.levels['3'] ?? [],
});

export const QUESTIONS: Record<DifficultyKey, Record<LevelKey, Question[]>> = {
  Eiken5: toLevelRecord(questionSetLibrary.eiken.grade5),
  Eiken4: toLevelRecord(questionSetLibrary.eiken.grade4),
  EikenPre1: toLevelRecord(questionSetLibrary.eiken.gradepre1),
};

export const QUESTION_SET_LIBRARY = questionSetLibrary;
