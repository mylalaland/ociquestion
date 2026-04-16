export type QuestionType = 'CSAT' | 'MULTIPLE_CHOICE' | 'SHORT_ANSWER';

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
