'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Info, BookOpen, ChevronDown, ChevronUp, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { QuizQuestion } from '@/lib/ai/types';

interface QuizViewProps {
  questions: QuizQuestion[];
  onCorrect: (qId: string, opts?: { halfPoints?: boolean }) => void;
  onWrong: (qId: string) => void;
  onShowContext: (context: string) => void;
  retryMultipleChoice?: boolean;
  quizFontSize?: string;
  showContextTiming?: 'always' | 'after_quiz';
  difficulty?: string;
  isFinalized?: boolean;
  onFinalize?: (score: number) => void;
  answerRevealTiming?: 'immediate' | 'after_all';
  // Review mode props (for viewing past quiz results)
  reviewMode?: boolean;
  initialUserAnswers?: Record<string, string>;
  initialUserAnswers2?: Record<string, string>;
  initialCorrectIds?: Set<string>;
  initialHalfPointIds?: Set<string>;
  onGetAnswers?: (answers: Record<string, string>, answers2: Record<string, string>) => void;
}

export function isAnswerCorrect(q: QuizQuestion, answer: string): boolean {
  if (!q.correctAnswer) return false;
  
  const cleanAns = answer.trim();
  const cleanCorrect = q.correctAnswer.trim();
  
  // O/X type
  if (q.type === 'TRUE_FALSE') {
    return cleanAns === cleanCorrect;
  }
  
  // 1. Exact match
  if (cleanAns === cleanCorrect) return true;
  
  // If it has options (MULTIPLE_CHOICE or CSAT)
  if (q.options && q.options.length > 0) {
    const ansIdx = q.options.indexOf(answer);
    
    const numMatch = cleanCorrect.match(/(\d+)/);
    const circularNumbers = ["①", "②", "③", "④", "⑤"];
    let correctIdx = -1;
    
    if (numMatch) {
      correctIdx = parseInt(numMatch[1], 10) - 1;
    } else {
      for (let idx = 0; idx < circularNumbers.length; idx++) {
        if (cleanCorrect.includes(circularNumbers[idx])) {
          correctIdx = idx;
          break;
        }
      }
    }
    
    if (correctIdx >= 0 && correctIdx < q.options.length) {
      if (ansIdx === correctIdx) return true;
    }
    
    const normalize = (str: string) => {
      const s = str.replace(/^(\d+[\.\s]|\d+번\s*|[\(\[\{]\d+[\)\]\}]\s*|[①②③④⑤]\s*)/, '');
      return s.replace(/[\s\p{P}]/gu, '');
    };
    
    const normCorrect = normalize(cleanCorrect);
    const normAns = normalize(cleanAns);
    
    if (normCorrect && normAns && (normCorrect === normAns || normCorrect.includes(normAns) || normAns.includes(normCorrect))) {
      return true;
    }
    
    for (let idx = 0; idx < q.options.length; idx++) {
      const optNorm = normalize(q.options[idx]);
      if (optNorm && normCorrect && (optNorm === normCorrect || normCorrect.includes(optNorm) || optNorm.includes(normCorrect))) {
        if (ansIdx === idx) return true;
      }
    }
  }
  
  return false;
}

export default function QuizView({ 
  questions, 
  onCorrect, 
  onWrong, 
  onShowContext,
  retryMultipleChoice = true,
  quizFontSize = 'medium',
  showContextTiming = 'always',
  difficulty,
  isFinalized = false,
  onFinalize,
  answerRevealTiming = 'immediate',
  reviewMode = false,
  initialUserAnswers,
  initialUserAnswers2,
  initialCorrectIds,
  initialHalfPointIds,
  onGetAnswers,
}: QuizViewProps) {
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>(initialUserAnswers || {});
  const [userAnswers2, setUserAnswers2] = useState<Record<string, string>>(initialUserAnswers2 || {}); // 1st wrong attempt
  const [isCorrect, setIsCorrect] = useState<Record<string, boolean>>({});
  const [showExplanation, setShowExplanation] = useState<Record<string, boolean>>({});
  const [shortAnswerInputs, setShortAnswerInputs] = useState<Record<string, string>>({});
  const [essayInputs, setEssayInputs] = useState<Record<string, string>>({});
  const [disabledOptions, setDisabledOptions] = useState<Record<string, string[]>>({});
  const [pendingAnswers, setPendingAnswers] = useState<Record<string, { answer: string; correct: boolean; halfPoints: boolean }>>({});
  const [allRevealed, setAllRevealed] = useState(false);
  const [showMyAnswers, setShowMyAnswers] = useState(true);

  const fontSizeClass = quizFontSize === 'small' ? 'text-base' : quizFontSize === 'large' ? 'text-3xl' : 'text-xl';
  
  const isAfterAll = answerRevealTiming === 'after_all';

  // Initialize review mode state
  useEffect(() => {
    if (reviewMode && initialCorrectIds && initialUserAnswers) {
      const correctMap: Record<string, boolean> = {};
      questions.forEach(q => {
        if (initialCorrectIds.has(q.id)) {
          correctMap[q.id] = true;
        } else if (initialUserAnswers[q.id]) {
          correctMap[q.id] = false;
        }
      });
      setIsCorrect(correctMap);
      setAllRevealed(true);
      
      // Reconstruct disabled options from userAnswers2
      if (initialUserAnswers2) {
        const disabled: Record<string, string[]> = {};
        Object.entries(initialUserAnswers2).forEach(([qId, ans]) => {
          if (ans && initialUserAnswers[qId] && ans !== initialUserAnswers[qId]) {
            disabled[qId] = [ans];
          }
        });
        setDisabledOptions(disabled);
      }
    }
  }, [reviewMode, initialCorrectIds, initialUserAnswers, initialUserAnswers2, questions]);

  // Report answers back to parent for saving
  useEffect(() => {
    if (onGetAnswers && Object.keys(userAnswers).length > 0) {
      onGetAnswers(userAnswers, userAnswers2);
    }
  }, [userAnswers, userAnswers2, onGetAnswers]);

  const handleAnswerSelect = useCallback((qId: string, answer: string, q: QuizQuestion) => {
    if (isFinalized || reviewMode || userAnswers[qId]) return;

    const correct = isAnswerCorrect(q, answer);
    
    if (!correct && retryMultipleChoice) {
      const currentDisabled = disabledOptions[qId] || [];
      if (currentDisabled.length === 0) {
        // First wrong attempt: save it and give another chance
        setDisabledOptions(prev => ({ ...prev, [qId]: [...currentDisabled, answer] }));
        setUserAnswers2(prev => ({ ...prev, [qId]: answer })); // Save first wrong attempt
        return;
      }
    }

    setUserAnswers(prev => ({ ...prev, [qId]: answer }));
    
    if (isAfterAll) {
      // Defer reveal
      const isSecondAttempt = (disabledOptions[qId] || []).length > 0;
      setPendingAnswers(prev => ({ ...prev, [qId]: { answer, correct, halfPoints: isSecondAttempt } }));
    } else {
      setIsCorrect(prev => ({ ...prev, [qId]: correct }));
      if (correct) {
        const isSecondAttempt = (disabledOptions[qId] || []).length > 0;
        onCorrect(qId, { halfPoints: isSecondAttempt });
      } else {
        onWrong(qId);
      }
    }
  }, [isFinalized, reviewMode, userAnswers, retryMultipleChoice, disabledOptions, isAfterAll, onCorrect, onWrong]);

  const handleOXSelect = useCallback((qId: string, answer: 'O' | 'X', q: QuizQuestion) => {
    if (isFinalized || reviewMode || userAnswers[qId]) return;
    
    const correct = q.correctAnswer === answer;
    setUserAnswers(prev => ({ ...prev, [qId]: answer }));
    
    if (isAfterAll) {
      setPendingAnswers(prev => ({ ...prev, [qId]: { answer, correct, halfPoints: false } }));
    } else {
      setIsCorrect(prev => ({ ...prev, [qId]: correct }));
      if (correct) onCorrect(qId);
      else onWrong(qId);
    }
  }, [isFinalized, reviewMode, userAnswers, isAfterAll, onCorrect, onWrong]);

  const handleShortAnswerSubmit = (qId: string, q: QuizQuestion) => {
    const answer = shortAnswerInputs[qId];
    if (isFinalized || reviewMode || userAnswers[qId] || !answer || !answer.trim()) return;
    
    setUserAnswers(prev => ({ ...prev, [qId]: answer.trim() }));
    
    if (answer.trim() === q.correctAnswer.trim()) {
      setIsCorrect(prev => ({ ...prev, [qId]: true }));
      onCorrect(qId);
    }
  };

  const handleEssaySubmit = (qId: string) => {
    const answer = essayInputs[qId];
    if (isFinalized || reviewMode || userAnswers[qId] || !answer || !answer.trim()) return;
    setUserAnswers(prev => ({ ...prev, [qId]: answer.trim() }));
  };

  const handleSelfGrade = (qId: string, isO: boolean) => {
    if (isFinalized || reviewMode) return;
    setIsCorrect(prev => ({ ...prev, [qId]: isO }));
    if (isO) onCorrect(qId);
    else onWrong(qId);
  };

  const toggleExplanation = (qId: string) => {
    setShowExplanation(prev => ({ ...prev, [qId]: !prev[qId] }));
  };

  // "Reveal All" for after_all mode
  const handleRevealAll = () => {
    const newCorrect: Record<string, boolean> = { ...isCorrect };
    Object.entries(pendingAnswers).forEach(([qId, pa]) => {
      newCorrect[qId] = pa.correct;
      if (pa.correct) onCorrect(qId, { halfPoints: pa.halfPoints });
      else onWrong(qId);
    });
    setIsCorrect(newCorrect);
    setAllRevealed(true);
  };

  const answeredCount = isAfterAll 
    ? Object.keys(pendingAnswers).length + questions.filter(q => isCorrect[q.id] !== undefined && !pendingAnswers[q.id]).length
    : questions.filter(q => isCorrect[q.id] !== undefined).length;
  const allAnswered = questions.every(q => userAnswers[q.id]);
  const isFinished = reviewMode ? true : (isAfterAll ? allRevealed : answeredCount === questions.length);
  const score = Object.values(isCorrect).filter(Boolean).length;

  const typeLabel = (type: string) => {
    switch (type) {
      case 'MULTIPLE_CHOICE': return '객관식';
      case 'SHORT_ANSWER': return '단답형';
      case 'ESSAY': return '서술형';
      case 'CSAT': return '수능형';
      case 'TRUE_FALSE': return 'O/X';
      default: return type;
    }
  };

  const showResult = (qId: string) => !isAfterAll || allRevealed || reviewMode;

  return (
    <div className="space-y-8">
      {/* Progress bar */}
      {!reviewMode && (
        <div className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur-md py-3 px-4 rounded-2xl border border-slate-800 mb-6">
          <div className="flex justify-between items-center text-sm mb-2">
            <span className="text-slate-400">진행률</span>
            <span className="font-bold text-white">
              {Object.keys(userAnswers).length}/{questions.length} 완료
            </span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(Object.keys(userAnswers).length / questions.length) * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>
      )}

      {/* Review mode toggle */}
      {reviewMode && (
        <div className="flex items-center justify-between bg-slate-800/50 rounded-2xl px-4 py-3 border border-slate-700/50">
          <span className="text-sm text-slate-300 font-bold">📋 내 답안 보기</span>
          <button
            onClick={() => setShowMyAnswers(!showMyAnswers)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold transition-all ${
              showMyAnswers ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-slate-700/50 text-slate-400 border border-slate-600'
            }`}
          >
            {showMyAnswers ? <Eye size={14} /> : <EyeOff size={14} />}
            {showMyAnswers ? '답안 표시 중' : '답안 숨김'}
          </button>
        </div>
      )}

      {questions.map((q, idx) => {
        const answered = !!userAnswers[q.id];
        const correct = isCorrect[q.id];
        const currentDisabled = disabledOptions[q.id] || [];
        const isSecondChanceActive = currentDisabled.length > 0 && !answered && !reviewMode;
        const resultVisible = showResult(q.id);
        const firstWrongAnswer = userAnswers2[q.id]; // The 1st wrong attempt answer
        
        return (
          <motion.div 
            key={q.id}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className={`glass p-6 md:p-8 rounded-3xl space-y-5 flex flex-col ${isSecondChanceActive ? 'ring-2 ring-amber-500/50' : ''}`}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex gap-2 items-center flex-wrap">
                <span className="px-3 py-1 bg-sky-500/20 text-sky-400 rounded-full text-xs font-bold uppercase tracking-wider">
                  {typeLabel(q.type)}
                </span>
                {difficulty && (
                  <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded-lg text-[10px] font-bold">
                    난이도: {difficulty}
                  </span>
                )}
              </div>
              <span className="text-slate-500 text-sm font-medium">문제 {idx + 1}</span>
            </div>

            {/* CSAT Passage */}
            {q.type === 'CSAT' && q.passage && (
              <div className="bg-slate-800/60 rounded-2xl p-5 border border-slate-700/50 text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">
                <div className="text-xs text-amber-400 font-bold mb-2 flex items-center gap-1">
                  📖 지문
                </div>
                {q.passage}
              </div>
            )}

            <h3 className={`font-bold leading-relaxed ${fontSizeClass} ${quizFontSize === 'large' ? 'mb-4' : ''}`}>
              {q.question}
            </h3>

            {isSecondChanceActive && (
              <div className="flex items-center gap-2 text-amber-400 text-sm font-bold bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                <AlertCircle size={16} />
                <span>오답입니다! 한 번 더 기회가 있습니다. 다시 풀어보세요. (포인트 50%)</span>
              </div>
            )}

            {/* ═══ TRUE_FALSE (O/X) ═══ */}
            {q.type === 'TRUE_FALSE' && (
              <div className="flex gap-4 justify-center">
                {(['O', 'X'] as const).map(choice => {
                  const isSelected = userAnswers[q.id] === choice;
                  const isThisCorrect = q.correctAnswer === choice;
                  
                  let btnStyle = 'w-28 h-28 rounded-3xl border-2 text-5xl font-black transition-all flex items-center justify-center ';
                  
                  const shouldShowResultState = resultVisible || reviewMode;

                  if (shouldShowResultState) {
                    if (isThisCorrect) {
                      btnStyle += 'border-emerald-500 bg-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-500/20';
                    } else if (isSelected && !isThisCorrect) {
                      btnStyle += 'border-rose-500 bg-rose-500/20 text-rose-400';
                    } else {
                      btnStyle += 'border-slate-800 text-slate-600 opacity-40';
                    }
                  } else if (answered) {
                    btnStyle += isSelected
                      ? 'border-sky-500 bg-sky-500/20 text-sky-400'
                      : 'border-slate-700 text-slate-500 opacity-50';
                  } else {
                    btnStyle += choice === 'O'
                      ? 'border-emerald-500/50 hover:bg-emerald-500/10 text-emerald-400 hover:border-emerald-400 hover:scale-105'
                      : 'border-rose-500/50 hover:bg-rose-500/10 text-rose-400 hover:border-rose-400 hover:scale-105';
                  }
                  
                  // Hide in review mode if showMyAnswers is off, but still show correct answer
                  if (reviewMode && !showMyAnswers && !isThisCorrect) {
                    btnStyle += ' opacity-30';
                  }
                  
                  return (
                    <button key={choice} disabled={isFinalized || reviewMode || answered} className={btnStyle}
                      onClick={() => handleOXSelect(q.id, choice, q)}>
                      {choice}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ═══ Multiple Choice / CSAT with options ═══ */}
            {q.type !== 'TRUE_FALSE' && q.options && q.options.length > 0 && (
              <div className="grid grid-cols-1 gap-3">
                {q.options.map((opt, i) => {
                  const isSelected = userAnswers[q.id] === opt;
                  const isFirstWrong = firstWrongAnswer === opt; // First wrong attempt
                  const isThisCorrectOption = isAnswerCorrect(q, opt);
                  const isOptionDisabled = currentDisabled.includes(opt);

                  let btnClass = "text-left p-4 rounded-xl border transition-all flex justify-between items-center ";
                  
                  const shouldShowResultState = resultVisible || reviewMode;
                  
                  if (shouldShowResultState) {
                    if (isThisCorrectOption) {
                      btnClass += "border-emerald-500 bg-emerald-500/10 text-emerald-300 font-bold border-2 shadow-sm shadow-emerald-500/20";
                    } else if (isSelected && !isThisCorrectOption) {
                      // 2nd attempt wrong
                      btnClass += "border-rose-500 bg-rose-500/10 text-rose-300 border-2";
                    } else if (isFirstWrong) {
                      // 1st attempt wrong - ALWAYS show this with red, don't use line-through
                      btnClass += "border-rose-500/60 bg-rose-500/10 text-rose-400 border-2";
                    } else {
                      btnClass += "border-slate-800 text-slate-500 opacity-50";
                    }
                  } else if (answered) {
                    if (isSelected) {
                      btnClass += "border-sky-500 bg-sky-500/10 text-sky-300";
                    } else if (isFirstWrong) {
                      // Keep showing 1st wrong attempt in after_all mode too
                      btnClass += "border-rose-500/50 bg-rose-500/5 text-rose-400/60";
                    } else {
                      btnClass += "border-slate-800 text-slate-500 opacity-50";
                    }
                  } else {
                    if (isOptionDisabled) {
                      // During 2nd chance: show 1st wrong as red and disabled
                      btnClass += "border-rose-500/50 bg-rose-500/10 text-rose-500/70 opacity-70 cursor-not-allowed";
                    } else {
                      btnClass += "border-slate-700 hover:border-sky-500 hover:bg-sky-500/5 text-slate-300";
                    }
                  }

                  // Review mode: dim non-selected options if showMyAnswers off
                  if (reviewMode && !showMyAnswers && !isThisCorrectOption && !isSelected && !isFirstWrong) {
                    btnClass += " opacity-30";
                  }

                  return (
                    <button
                      key={i}
                      disabled={isFinalized || reviewMode || answered || isOptionDisabled}
                      className={btnClass}
                      onClick={() => handleAnswerSelect(q.id, opt, q)}
                    >
                      <div className="flex items-center">
                        <span className={`mr-3 font-bold ${answered || isOptionDisabled ? '' : 'text-sky-500'}`}>{i + 1}.</span> 
                        {opt}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {answered && resultVisible && isThisCorrectOption && <CheckCircle2 size={18} className="text-emerald-400" />}
                        {answered && resultVisible && isSelected && !correct && <XCircle size={18} className="text-rose-400" />}
                        {answered && resultVisible && isFirstWrong && !isSelected && <XCircle size={14} className="text-rose-400/60" />}
                        {/* During 2nd chance phase: show X on disabled option */}
                        {!answered && isOptionDisabled && <XCircle size={16} className="text-rose-400/60" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ═══ Short Answer ═══ */}
            {q.type === 'SHORT_ANSWER' && (!q.options || q.options.length === 0) && (
              <div className="space-y-4">
                {answered ? (
                    <div className={`p-4 rounded-xl border ${isCorrect[q.id] === true ? 'border-emerald-500 bg-emerald-500/10 text-emerald-100' : isCorrect[q.id] === false ? 'border-rose-500 bg-rose-500/10 text-rose-100' : 'border-sky-500 bg-sky-500/10 text-slate-200'}`}>
                      <div className={`flex items-center gap-2 mb-4 font-bold ${isCorrect[q.id] === true ? 'text-emerald-400' : isCorrect[q.id] === false ? 'text-rose-400' : 'text-sky-400'}`}>
                         <CheckCircle2 size={18} />
                         {isCorrect[q.id] === undefined ? '제출 완료! 모범 답안과 비교하여 스스로 채점해주세요.' : '채점 완료 시스템에 기록되었습니다.'}
                      </div>
                      <div className="space-y-3 text-sm">
                        {showMyAnswers && (
                          <div>
                            <span className="text-slate-400 text-xs uppercase tracking-wider block mb-1">내 답안</span>
                            <p className="bg-slate-900/50 p-3 rounded-lg border border-slate-700">{userAnswers[q.id]}</p>
                          </div>
                        )}
                        <div>
                          <span className="text-emerald-400 text-xs uppercase tracking-wider block mb-1">💡 모범 답안</span>
                          <p className="bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/30 text-emerald-100">{q.correctAnswer}</p>
                        </div>
                      </div>
                      {isCorrect[q.id] === undefined && !isFinalized && !reviewMode && (
                        <div className="mt-4 pt-4 border-t border-sky-500/20 flex gap-2 justify-end">
                          <button onClick={() => handleSelfGrade(q.id, true)}
                            className="px-4 py-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg text-sm font-bold transition-colors">
                            O 맞게 썼음 (정답)
                          </button>
                          <button onClick={() => handleSelfGrade(q.id, false)}
                            className="px-4 py-2 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded-lg text-sm font-bold transition-colors">
                            X 틀렸음 (오답)
                          </button>
                        </div>
                      )}
                    </div>
                ) : (
                  <div className="flex gap-3">
                    <input type="text" placeholder="짧게 답을 적어주세요..."
                      value={shortAnswerInputs[q.id] || ''}
                      onChange={(e) => setShortAnswerInputs(prev => ({ ...prev, [q.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleShortAnswerSubmit(q.id, q); }}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500" />
                    <button className="btn-premium px-6 py-2 rounded-xl text-sm font-bold whitespace-nowrap disabled:opacity-50"
                      onClick={() => handleShortAnswerSubmit(q.id, q)}
                      disabled={isFinalized || !shortAnswerInputs[q.id]?.trim()}>
                      답안 제출
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ═══ Essay ═══ */}
            {(q.type === 'ESSAY' || (q.type === 'CSAT' && (!q.options || q.options.length === 0))) && (
              <div className="space-y-4">
                {answered ? (
                    <div className={`p-4 rounded-xl border ${isCorrect[q.id] === true ? 'border-emerald-500 bg-emerald-500/10 text-emerald-100' : isCorrect[q.id] === false ? 'border-rose-500 bg-rose-500/10 text-rose-100' : 'border-sky-500 bg-sky-500/10 text-slate-200'}`}>
                      <div className={`flex items-center gap-2 mb-4 font-bold ${isCorrect[q.id] === true ? 'text-emerald-400' : isCorrect[q.id] === false ? 'text-rose-400' : 'text-sky-400'}`}>
                         <CheckCircle2 size={18} />
                         {isCorrect[q.id] === undefined ? '제출 완료! 모범 답안과 비교하여 스스로 채점해주세요.' : '채점 완료 시스템에 기록되었습니다.'}
                      </div>
                      <div className="space-y-3 text-sm">
                        {showMyAnswers && (
                          <div>
                            <span className="text-slate-400 text-xs uppercase tracking-wider block mb-1">내 답안</span>
                            <p className="bg-slate-900/50 p-3 rounded-lg border border-slate-700 whitespace-pre-wrap">{userAnswers[q.id]}</p>
                          </div>
                        )}
                        <div>
                          <span className="text-emerald-400 text-xs uppercase tracking-wider block mb-1">💡 모범 답안</span>
                          <p className="bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/30 text-emerald-100 whitespace-pre-wrap">{q.correctAnswer}</p>
                        </div>
                      </div>
                      {isCorrect[q.id] === undefined && !isFinalized && !reviewMode && (
                        <div className="mt-4 pt-4 border-t border-sky-500/20 flex gap-2 justify-end">
                          <button onClick={() => handleSelfGrade(q.id, true)}
                            className="px-4 py-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg text-sm font-bold transition-colors">
                            O 맞게 썼음 (정답)
                          </button>
                          <button onClick={() => handleSelfGrade(q.id, false)}
                            className="px-4 py-2 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded-lg text-sm font-bold transition-colors">
                            X 틀렸음 (오답)
                          </button>
                        </div>
                      )}
                    </div>
                ) : (
                  <div className="space-y-3">
                    <textarea placeholder="자유롭게 답안을 서술하세요..."
                      value={essayInputs[q.id] || ''}
                      onChange={(e) => setEssayInputs(prev => ({ ...prev, [q.id]: e.target.value }))}
                      rows={4}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none" />
                    <button className="btn-premium px-6 py-3 rounded-xl text-sm font-bold whitespace-nowrap disabled:opacity-50 w-full"
                      onClick={() => handleEssaySubmit(q.id)}
                      disabled={isFinalized || !essayInputs[q.id]?.trim()}>
                      답안 제출
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Footer: context + explanation */}
            <div className="mt-auto pt-5 border-t border-slate-800 space-y-4">
              <div className="flex flex-wrap gap-4 items-center">
                {(!showContextTiming || showContextTiming === 'always' || isFinished) && (
                  <button onClick={() => onShowContext(q.sourceContext)}
                    className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors">
                    <BookOpen size={16} />
                    <span>원문 근거 확인</span>
                  </button>
                )}
                {answered && resultVisible && (
                  <button onClick={() => toggleExplanation(q.id)}
                    className="flex items-center gap-2 text-sm text-sky-400 hover:text-sky-300 transition-colors ml-auto">
                    <Info size={16} />
                    <span>{showExplanation[q.id] ? '해설 닫기' : 'AI 해설 보기'}</span>
                    {showExplanation[q.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                )}
              </div>
              
              <AnimatePresence>
                {answered && resultVisible && showExplanation[q.id] && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="p-4 mt-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                      {q.explanation}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        );
      })}

      {/* "Reveal All" button for after_all mode */}
      {isAfterAll && allAnswered && !allRevealed && !reviewMode && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="glass p-8 rounded-3xl text-center space-y-4 border-2 border-sky-500/50">
          <h3 className="text-xl font-bold">모든 문제를 풀었습니다!</h3>
          <p className="text-slate-400 text-sm">아래 버튼을 눌러 정답을 확인하세요.</p>
          <button onClick={handleRevealAll}
            className="btn-premium px-10 py-4 rounded-2xl font-bold text-lg hover:scale-105 transition-transform">
            📊 정답 확인하기
          </button>
        </motion.div>
      )}

      {/* Completion */}
      <AnimatePresence>
        {isFinished && !reviewMode && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="glass p-8 rounded-3xl mt-8 text-center relative overflow-hidden border-2 border-emerald-500/50"
          >
            <div className="absolute inset-0 bg-emerald-500/10" />
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-20 h-20 bg-emerald-500 mb-6 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/40 text-4xl text-white">
                🎉
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">모든 문제를 풀었습니다!</h2>
              <p className="text-emerald-400 font-bold text-xl mb-4">
                총 {questions.length}문제 중 <span className="text-white text-4xl mx-2">{score}</span>문제를 맞혔습니다!
              </p>
              {isFinalized ? (
                <div className="space-y-4 w-full mt-4">
                  <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 text-slate-300">
                    🔒 이미 확정 및 저장된 기록입니다.
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <p className="text-slate-400 text-sm mb-4">
                    모든 문제를 스스로 채점하고 최종 결과에 동의한다면<br/>아래 버튼을 눌러 점수를 기록하고 확정하세요.
                  </p>
                  <button 
                    onClick={() => { if(onFinalize) onFinalize(score); }}
                    className="btn-premium px-8 py-4 rounded-2xl font-bold flex items-center gap-2 mx-auto text-lg hover:scale-105 transition-transform"
                  >
                    🏆 결과 확정 및 성적표 보기
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
