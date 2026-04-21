export type QuestionType = 'CSAT' | 'MULTIPLE_CHOICE' | 'SHORT_ANSWER' | 'ESSAY';

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[]; // For MULTIPLE_CHOICE or CSAT
  correctAnswer: string;
  explanation: string;
  sourceContext: string; // The specific sentence/paragraph from the original document
}

export interface QuizResult {
  title: string;
  questions: QuizQuestion[];
  summary: string;
  extractedText?: string;
}

export interface AIProviderConfig {
  apiKey: string;
  modelName?: string;
}

// Point configuration per question type
export interface PointConfig {
  MULTIPLE_CHOICE: number;
  SHORT_ANSWER: number;
  ESSAY: number;
  CSAT: number;
}

export const DEFAULT_POINT_CONFIG: PointConfig = {
  MULTIPLE_CHOICE: 10,
  SHORT_ANSWER: 10,
  ESSAY: 15,
  CSAT: 20,
};
