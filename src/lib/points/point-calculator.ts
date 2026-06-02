import { QuizQuestion, PointConfig, AdvancedPointSettings, DEFAULT_ADVANCED_POINT_SETTINGS } from '../ai/types';

export interface PointCalculationResult {
  totalEarned: number;
  breakdown: { questionId: string; points: number; reason: string }[];
  passed: boolean;
  bonusTriggered: boolean;
  bonusPoints: number;
  difficultyMultiplier: number;
}

export function calculatePoints(
  questions: QuizQuestion[],
  correctIds: Set<string>,
  halfPointIds: Set<string>,
  passThreshold: number,
  pointConfig: PointConfig,
  difficulty: string,
  advanced: AdvancedPointSettings = DEFAULT_ADVANCED_POINT_SETTINGS
): PointCalculationResult {
  const totalQuestions = questions.length;
  const correctCount = correctIds.size;
  const percent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const passed = percent >= passThreshold;
  
  // Difficulty multiplier
  let difficultyMultiplier = 1.0;
  if (difficulty === '어려움') {
    difficultyMultiplier = advanced.difficultyWeightHard;
  } else if (difficulty === '쉬움') {
    difficultyMultiplier = advanced.difficultyWeightEasy;
  }
  
  // Check minimum question count
  if (totalQuestions < advanced.minQuestionsForPoints) {
    return {
      totalEarned: 0,
      breakdown: [{ questionId: '', points: 0, reason: `최소 ${advanced.minQuestionsForPoints}문제 이상이어야 포인트를 받을 수 있습니다` }],
      passed,
      bonusTriggered: false,
      bonusPoints: 0,
      difficultyMultiplier,
    };
  }
  
  const breakdown: { questionId: string; points: number; reason: string }[] = [];
  let totalEarned = 0;
  
  if (passed || advanced.allowPartialPoints) {
    questions.forEach(q => {
      if (correctIds.has(q.id)) {
        const base = pointConfig[q.type as keyof PointConfig] || 10;
        let points = halfPointIds.has(q.id) ? Math.floor(base * 0.5) : base;
        points = Math.round(points * difficultyMultiplier);
        
        if (!passed && advanced.allowPartialPoints) {
          points = Math.round(points * advanced.partialPointsRatio);
        }
        
        totalEarned += points;
        breakdown.push({
          questionId: q.id,
          points,
          reason: halfPointIds.has(q.id) ? '2차 시도 정답 (50%)' : '정답',
        });
      }
    });
  }
  
  // Bonus check: all correct + probability
  let bonusTriggered = false;
  let bonusPoints = 0;
  
  if (advanced.bonusEnabled && correctCount === totalQuestions && totalQuestions > 0) {
    const roll = Math.random() * 100;
    if (roll < advanced.bonusProbability) {
      bonusTriggered = true;
      bonusPoints = Math.floor(
        Math.random() * (advanced.bonusMaxPoints - advanced.bonusMinPoints + 1) + advanced.bonusMinPoints
      );
    }
  }
  
  return {
    totalEarned: totalEarned + bonusPoints,
    breakdown,
    passed,
    bonusTriggered,
    bonusPoints,
    difficultyMultiplier,
  };
}
