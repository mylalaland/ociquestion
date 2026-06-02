export type QuestionType = 'CSAT' | 'MULTIPLE_CHOICE' | 'SHORT_ANSWER' | 'ESSAY' | 'TRUE_FALSE';

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  question: string;
  passage?: string; // For CSAT type - the reading passage
  options?: string[]; // For MULTIPLE_CHOICE or CSAT
  correctAnswer: string;
  explanation: string;
  sourceContext: string; // The specific sentence/paragraph from the original document
  userAnswer?: string; // Store user's answer for review
  userAnswer2?: string; // Store 2nd attempt answer for multiple choice
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
  TRUE_FALSE: number;
}

export const DEFAULT_POINT_CONFIG: PointConfig = {
  MULTIPLE_CHOICE: 10,
  SHORT_ANSWER: 10,
  ESSAY: 15,
  CSAT: 20,
  TRUE_FALSE: 5, // O/X is half of multiple choice by default
};

// Advanced point settings
export interface AdvancedPointSettings {
  // Difficulty weight
  difficultyWeightHard: number; // e.g., 1.2 = +20%
  difficultyWeightEasy: number; // e.g., 0.8 = -20%
  
  // Partial points when failing
  allowPartialPoints: boolean;
  partialPointsRatio: number; // e.g., 0.5 = 50% of normal points
  
  // Minimum questions required
  minQuestionsForPoints: number;
  
  // Bonus system
  bonusEnabled: boolean;
  bonusMode: 'roulette' | 'card';
  bonusProbability: number; // 0-100, chance of bonus appearing when all correct
  bonusMinPoints: number;
  bonusMaxPoints: number;
  
  // Answer reveal timing
  answerRevealTiming: 'immediate' | 'after_all'; // per question vs after all questions
  
  // Multiple choice options count
  multipleChoiceCount: 4 | 5;
}

export const DEFAULT_ADVANCED_POINT_SETTINGS: AdvancedPointSettings = {
  difficultyWeightHard: 1.2,
  difficultyWeightEasy: 0.8,
  allowPartialPoints: false,
  partialPointsRatio: 0.5,
  minQuestionsForPoints: 3,
  bonusEnabled: true,
  bonusMode: 'roulette',
  bonusProbability: 30, // 30% chance
  bonusMinPoints: 5,
  bonusMaxPoints: 50,
  answerRevealTiming: 'immediate',
  multipleChoiceCount: 5,
};

// Theme types
export type ThemeId = 'dark' | 'light' | 'yellow' | 'cat';

export interface ThemeOption {
  id: ThemeId;
  name: string;
  emoji: string;
  description: string;
  preview: string; // CSS gradient for preview
}

export const THEME_OPTIONS: ThemeOption[] = [
  { id: 'dark', name: '다크 모드', emoji: '🌙', description: '기본 어두운 테마', preview: 'linear-gradient(135deg, #0f172a, #1e293b)' },
  { id: 'light', name: '밝은 모드', emoji: '☀️', description: '깔끔한 밝은 테마', preview: 'linear-gradient(135deg, #f8fafc, #e2e8f0)' },
  { id: 'yellow', name: '노란 모드', emoji: '🌻', description: '따뜻한 크림 톤', preview: 'linear-gradient(135deg, #fef9c3, #fde68a)' },
  { id: 'cat', name: '고양이 모드', emoji: '🐱', description: '귀여운 핑크 테마', preview: 'linear-gradient(135deg, #fce7f3, #e9d5ff)' },
];

// User profile for multi-user support
export interface UserProfile {
  id: string;
  name: string;
  avatar: string; // emoji
  createdAt: string;
}

// Random name parts for default names
export const COLORS_KR = ['파란', '빨간', '노란', '초록', '보라', '분홍', '하늘', '주황', '은빛', '금빛'];
export const ANIMALS_KR = ['고양이', '토끼', '강아지', '여우', '곰돌이', '펭귄', '다람쥐', '올빼미', '사자', '판다'];
export const ANIMAL_EMOJIS = ['🐱', '🐰', '🐶', '🦊', '🐻', '🐧', '🐿️', '🦉', '🦁', '🐼'];
