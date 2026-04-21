'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Info, BookOpen, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
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
  onFinalize
}: QuizViewProps) {
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [isCorrect, setIsCorrect] = useState<Record<string, boolean>>({});
  const [showExplanation, setShowExplanation] = useState<Record<string, boolean>>({});
  const [shortAnswerInputs, setShortAnswerInputs] = useState<Record<string, string>>({});
  const [essayInputs, setEssayInputs] = useState<Record<string, string>>({});
  const [disabledOptions, setDisabledOptions] = useState<Record<string, string[]>>({});

  const fontSizeClass = quizFontSize === 'small' ? 'text-base' : quizFontSize === 'large' ? 'text-3xl' : 'text-xl';

  const handleAnswerSelect = (qId: string, answer: string, correctAnswer: string) => {
    if (isFinalized || userAnswers[qId]) return;

    const correct = answer === correctAnswer;
    
    if (!correct && retryMultipleChoice) {
      const currentDisabled = disabledOptions[qId] || [];
      if (currentDisabled.length === 0) {
        // First strike — give second chance
        setDisabledOptions(prev => ({ ...prev, [qId]: [...currentDisabled, answer] }));
        return;
      }
    }

    // Finalize answer
    setUserAnswers(prev => ({ ...prev, [qId]: answer }));
    setIsCorrect(prev => ({ ...prev, [qId]: correct }));
    
    if (correct) {
      const isSecondAttempt = (disabledOptions[qId] || []).length > 0;
      onCorrect(qId, { halfPoints: isSecondAttempt });
    } else {
      onWrong(qId);
    }
  };

  const handleShortAnswerSubmit = (qId: string, q: QuizQuestion) => {
    const answer = shortAnswerInputs[qId];
    if (isFinalized || userAnswers[qId] || !answer || !answer.trim()) return;
    
    setUserAnswers(prev => ({ ...prev, [qId]: answer.trim() }));
    
    if (answer.trim() === q.correctAnswer.trim()) {
      setIsCorrect(prev => ({ ...prev, [qId]: true }));
      onCorrect(qId);
    }
  };

  const handleEssaySubmit = (qId: string) => {
    const answer = essayInputs[qId];
    if (isFinalized || userAnswers[qId] || !answer || !answer.trim()) return;
    
    // Save to reveal model answer — requires self-grading
    setUserAnswers(prev => ({ ...prev, [qId]: answer.trim() }));
  };

  const handleSelfGrade = (qId: string, isO: boolean) => {
    if (isFinalized) return;
    setIsCorrect(prev => ({ ...prev, [qId]: isO }));
    if (isO) onCorrect(qId);
    else onWrong(qId);
  };

  const toggleExplanation = (qId: string) => {
    setShowExplanation(prev => ({ ...prev, [qId]: !prev[qId] }));
  };

  const answeredCount = questions.filter(q => isCorrect[q.id] !== undefined).length;
  const isFinished = answeredCount === questions.length;
  const score = Object.values(isCorrect).filter(Boolean).length;

  const typeLabel = (type: string) => {
    switch (type) {
      case 'MULTIPLE_CHOICE': return '객관식';
      case 'SHORT_ANSWER': return '단답형';
      case 'ESSAY': return '서술형';
      case 'CSAT': return '수능형';
      default: return type;
    }
  };

  return (
    <div className="space-y-12">
      {/* Progress bar */}
      <div className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur-md py-3 px-4 rounded-2xl border border-slate-800 mb-6">
        <div className="flex justify-between items-center text-sm mb-2">
          <span className="text-slate-400">진행률</span>
          <span className="font-bold text-white">{answeredCount}/{questions.length} 완료</span>
        </div>
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${(answeredCount / questions.length) * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {questions.map((q, idx) => {
        const answered = !!userAnswers[q.id];
        const correct = isCorrect[q.id];
        const currentDisabled = disabledOptions[q.id] || [];
        const isSecondChanceActive = currentDisabled.length > 0 && !answered;
        
        return (
          <motion.div 
            key={q.id}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className={`glass p-8 rounded-3xl space-y-6 flex flex-col ${isSecondChanceActive ? 'ring-2 ring-amber-500/50' : ''}`}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex gap-2 items-center">
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

            <h3 className={`font-bold leading-relaxed ${fontSizeClass} ${quizFontSize === 'large' ? 'mb-4' : ''}`}>
              {q.question}
            </h3>

            {isSecondChanceActive && (
              <div className="flex items-center gap-2 text-amber-400 text-sm font-bold bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                <AlertCircle size={16} />
                <span>오답입니다! 한 번 더 기회가 있습니다. 다시 풀어보세요. (포인트 50%)</span>
              </div>
            )}

            {/* Multiple Choice / CSAT with options */}
            {q.options && q.options.length > 0 && (
              <div className="grid grid-cols-1 gap-3">
                {q.options.map((opt, i) => {
                  const isSelected = userAnswers[q.id] === opt;
                  const isThisCorrectOption = opt === q.correctAnswer;
                  const isOptionDisabled = currentDisabled.includes(opt);

                  let btnClass = "text-left p-4 rounded-xl border transition-all flex justify-between items-center ";
                  
                  if (answered) {
                    if (isThisCorrectOption) {
                      btnClass += "border-emerald-500 bg-emerald-500/10 text-emerald-300";
                    } else if (isSelected && !correct) {
                       btnClass += "border-rose-500 bg-rose-500/10 text-rose-300";
                    } else {
                       btnClass += "border-slate-800 text-slate-500 opacity-50";
                    }
                  } else {
                    if (isOptionDisabled) {
                      btnClass += "border-rose-500/50 bg-rose-500/5 text-rose-500/50 opacity-60 line-through cursor-not-allowed";
                    } else {
                      btnClass += "border-slate-700 hover:border-sky-500 hover:bg-sky-500/5 text-slate-300";
                    }
                  }

                  return (
                    <button
                      key={i}
                      disabled={isFinalized || answered || isOptionDisabled}
                      className={btnClass}
                      onClick={() => handleAnswerSelect(q.id, opt, q.correctAnswer)}
                    >
                      <div className="flex items-center">
                        <span className={`mr-3 font-bold ${answered || isOptionDisabled ? '' : 'text-sky-500'}`}>{i + 1}.</span> 
                        {opt}
                      </div>
                      {answered && isThisCorrectOption && <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />}
                      {answered && isSelected && !correct && <XCircle size={18} className="text-rose-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Short Answer */}
            {q.type === 'SHORT_ANSWER' && (!q.options || q.options.length === 0) && (
              <div className="space-y-4">
                {answered ? (
                    <div className={`p-4 rounded-xl border ${isCorrect[q.id] === true ? 'border-emerald-500 bg-emerald-500/10 text-emerald-100' : isCorrect[q.id] === false ? 'border-rose-500 bg-rose-500/10 text-rose-100' : 'border-sky-500 bg-sky-500/10 text-slate-200'}`}>
                      <div className={`flex items-center gap-2 mb-4 font-bold ${isCorrect[q.id] === true ? 'text-emerald-400' : isCorrect[q.id] === false ? 'text-rose-400' : 'text-sky-400'}`}>
                         <CheckCircle2 size={18} />
                         {isCorrect[q.id] === undefined ? '제출 완료! 모범 답안과 비교하여 스스로 채점해주세요.' : '채점 완료 시스템에 기록되었습니다.'}
                      </div>
                      <div className="space-y-3 text-sm">
                        <div>
                          <span className="text-slate-400 text-xs uppercase tracking-wider block mb-1">내 답안</span>
                          <p className="bg-slate-900/50 p-3 rounded-lg border border-slate-700">{userAnswers[q.id]}</p>
                        </div>
                        <div>
                          <span className="text-emerald-400 text-xs uppercase tracking-wider block mb-1">💡 모범 답안</span>
                          <p className="bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/30 text-emerald-100">{q.correctAnswer}</p>
                        </div>
                      </div>
                      {isCorrect[q.id] === undefined && !isFinalized && (
                        <div className="mt-4 pt-4 border-t border-sky-500/20 flex gap-2 justify-end">
                          <button 
                            onClick={() => handleSelfGrade(q.id, true)}
                            className="px-4 py-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg text-sm font-bold transition-colors"
                          >
                            O 맞게 썼음 (정답)
                          </button>
                          <button 
                            onClick={() => handleSelfGrade(q.id, false)}
                            className="px-4 py-2 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded-lg text-sm font-bold transition-colors"
                          >
                            X 틀렸음 (오답)
                          </button>
                        </div>
                      )}
                    </div>
                ) : (
                  <div className="flex gap-3">
                    <input 
                      type="text"
                      placeholder="짧게 답을 적어주세요..."
                      value={shortAnswerInputs[q.id] || ''}
                      onChange={(e) => setShortAnswerInputs(prev => ({ ...prev, [q.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleShortAnswerSubmit(q.id, q);
                      }}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <button 
                      className="btn-premium px-6 py-2 rounded-xl text-sm font-bold whitespace-nowrap disabled:opacity-50"
                      onClick={() => handleShortAnswerSubmit(q.id, q)}
                      disabled={isFinalized || !shortAnswerInputs[q.id]?.trim()}
                    >
                      답안 제출
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Essay (서술형) */}
            {q.type === 'ESSAY' && (!q.options || q.options.length === 0) && (
              <div className="space-y-4">
                {answered ? (
                    <div className={`p-4 rounded-xl border ${isCorrect[q.id] === true ? 'border-emerald-500 bg-emerald-500/10 text-emerald-100' : isCorrect[q.id] === false ? 'border-rose-500 bg-rose-500/10 text-rose-100' : 'border-sky-500 bg-sky-500/10 text-slate-200'}`}>
                      <div className={`flex items-center gap-2 mb-4 font-bold ${isCorrect[q.id] === true ? 'text-emerald-400' : isCorrect[q.id] === false ? 'text-rose-400' : 'text-sky-400'}`}>
                         <CheckCircle2 size={18} />
                         {isCorrect[q.id] === undefined ? '제출 완료! 모범 답안과 비교하여 스스로 채점해주세요.' : '채점 완료 시스템에 기록되었습니다.'}
                      </div>
                      <div className="space-y-3 text-sm">
                        <div>
                          <span className="text-slate-400 text-xs uppercase tracking-wider block mb-1">내 답안</span>
                          <p className="bg-slate-900/50 p-3 rounded-lg border border-slate-700 whitespace-pre-wrap">{userAnswers[q.id]}</p>
                        </div>
                        <div>
                          <span className="text-emerald-400 text-xs uppercase tracking-wider block mb-1">💡 모범 답안</span>
                          <p className="bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/30 text-emerald-100 whitespace-pre-wrap">{q.correctAnswer}</p>
                        </div>
                      </div>
                      {isCorrect[q.id] === undefined && !isFinalized && (
                        <div className="mt-4 pt-4 border-t border-sky-500/20 flex gap-2 justify-end">
                          <button 
                            onClick={() => handleSelfGrade(q.id, true)}
                            className="px-4 py-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg text-sm font-bold transition-colors"
                          >
                            O 맞게 썼음 (정답)
                          </button>
                          <button 
                            onClick={() => handleSelfGrade(q.id, false)}
                            className="px-4 py-2 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded-lg text-sm font-bold transition-colors"
                          >
                            X 틀렸음 (오답)
                          </button>
                        </div>
                      )}
                    </div>
                ) : (
                  <div className="space-y-3">
                    <textarea
                      placeholder="자유롭게 답안을 서술하세요..."
                      value={essayInputs[q.id] || ''}
                      onChange={(e) => setEssayInputs(prev => ({ ...prev, [q.id]: e.target.value }))}
                      rows={4}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                    />
                    <button 
                      className="btn-premium px-6 py-3 rounded-xl text-sm font-bold whitespace-nowrap disabled:opacity-50 w-full"
                      onClick={() => handleEssaySubmit(q.id)}
                      disabled={isFinalized || !essayInputs[q.id]?.trim()}
                    >
                      답안 제출
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* CSAT without options (fallback) */}
            {q.type === 'CSAT' && (!q.options || q.options.length === 0) && (
              <div className="space-y-4">
                {answered ? (
                    <div className={`p-4 rounded-xl border ${isCorrect[q.id] === true ? 'border-emerald-500 bg-emerald-500/10 text-emerald-100' : isCorrect[q.id] === false ? 'border-rose-500 bg-rose-500/10 text-rose-100' : 'border-sky-500 bg-sky-500/10 text-slate-200'}`}>
                      <div className={`flex items-center gap-2 mb-4 font-bold ${isCorrect[q.id] === true ? 'text-emerald-400' : isCorrect[q.id] === false ? 'text-rose-400' : 'text-sky-400'}`}>
                         <CheckCircle2 size={18} />
                         {isCorrect[q.id] === undefined ? '제출 완료! 모범 답안과 비교하여 스스로 채점해주세요.' : '채점 완료 시스템에 기록되었습니다.'}
                      </div>
                      <div className="space-y-3 text-sm">
                        <div>
                          <span className="text-slate-400 text-xs uppercase tracking-wider block mb-1">내 답안</span>
                          <p className="bg-slate-900/50 p-3 rounded-lg border border-slate-700 whitespace-pre-wrap">{userAnswers[q.id]}</p>
                        </div>
                        <div>
                          <span className="text-emerald-400 text-xs uppercase tracking-wider block mb-1">💡 모범 답안</span>
                          <p className="bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/30 text-emerald-100 whitespace-pre-wrap">{q.correctAnswer}</p>
                        </div>
                      </div>
                      {isCorrect[q.id] === undefined && !isFinalized && (
                        <div className="mt-4 pt-4 border-t border-sky-500/20 flex gap-2 justify-end">
                          <button 
                            onClick={() => handleSelfGrade(q.id, true)}
                            className="px-4 py-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg text-sm font-bold transition-colors"
                          >
                            O 맞게 썼음 (정답)
                          </button>
                          <button 
                            onClick={() => handleSelfGrade(q.id, false)}
                            className="px-4 py-2 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded-lg text-sm font-bold transition-colors"
                          >
                            X 틀렸음 (오답)
                          </button>
                        </div>
                      )}
                    </div>
                ) : (
                  <div className="space-y-3">
                    <textarea
                      placeholder="자유롭게 답안을 서술하세요..."
                      value={essayInputs[q.id] || ''}
                      onChange={(e) => setEssayInputs(prev => ({ ...prev, [q.id]: e.target.value }))}
                      rows={4}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                    />
                    <button 
                      className="btn-premium px-6 py-3 rounded-xl text-sm font-bold whitespace-nowrap disabled:opacity-50 w-full"
                      onClick={() => handleEssaySubmit(q.id)}
                      disabled={isFinalized || !essayInputs[q.id]?.trim()}
                    >
                      답안 제출
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="mt-auto pt-6 border-t border-slate-800 space-y-4">
              <div className="flex flex-wrap gap-4 items-center">
                {(!showContextTiming || showContextTiming === 'always' || isFinished) && (
                  <button 
                    onClick={() => onShowContext(q.sourceContext)}
                    className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    <BookOpen size={16} />
                    <span>원문 근거 확인</span>
                  </button>
                )}
                {answered && (
                  <button 
                    onClick={() => toggleExplanation(q.id)}
                    className="flex items-center gap-2 text-sm text-sky-400 hover:text-sky-300 transition-colors ml-auto"
                  >
                    <Info size={16} />
                    <span>{showExplanation[q.id] ? '해설 닫기' : 'AI 해설 보기'}</span>
                    {showExplanation[q.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                )}
              </div>
              
              <AnimatePresence>
                {answered && showExplanation[q.id] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
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

      <AnimatePresence>
        {isFinished && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="glass p-8 rounded-3xl mt-12 text-center relative overflow-hidden border-2 border-emerald-500/50"
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
