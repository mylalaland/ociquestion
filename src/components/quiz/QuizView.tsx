'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Info, BookOpen, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { QuizQuestion } from '@/lib/ai/types';

interface QuizViewProps {
  questions: QuizQuestion[];
  onCorrect: (qId: string) => void;
  onWrong: (qId: string) => void;
  onShowContext: (context: string) => void;
  retryMultipleChoice?: boolean;
  quizFontSize?: string;
}

export default function QuizView({ 
  questions, 
  onCorrect, 
  onWrong, 
  onShowContext,
  retryMultipleChoice = true,
  quizFontSize = 'medium'
}: QuizViewProps) {
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [isCorrect, setIsCorrect] = useState<Record<string, boolean>>({});
  const [showExplanation, setShowExplanation] = useState<Record<string, boolean>>({});
  const [shortAnswerInputs, setShortAnswerInputs] = useState<Record<string, string>>({});
  const [disabledOptions, setDisabledOptions] = useState<Record<string, string[]>>({});

  const fontSizeClass = quizFontSize === 'small' ? 'text-base' : quizFontSize === 'large' ? 'text-3xl' : 'text-xl';

  const handleAnswerSelect = (qId: string, answer: string, correctAnswer: string) => {
    if (userAnswers[qId]) return;

    const correct = answer === correctAnswer;
    
    if (!correct && retryMultipleChoice) {
      const currentDisabled = disabledOptions[qId] || [];
      if (currentDisabled.length === 0) {
        // First strike
        setDisabledOptions(prev => ({ ...prev, [qId]: [...currentDisabled, answer] }));
        return; // Give second chance, don't finalize
      }
    }

    // Finalize answer (correct or 2nd wrong)
    setUserAnswers(prev => ({ ...prev, [qId]: answer }));
    setIsCorrect(prev => ({ ...prev, [qId]: correct }));
    
    if (correct) onCorrect(qId);
    else onWrong(qId);
  };

  const handleShortAnswerSubmit = (qId: string) => {
    const answer = shortAnswerInputs[qId];
    if (userAnswers[qId] || !answer || !answer.trim()) return;
    
    // We don't strictly grade as correct/wrong, we just save it to reveal model answer.
    setUserAnswers(prev => ({ ...prev, [qId]: answer.trim() }));
    // No trigger to onCorrect/onWrong here for short answers because it's self-evaluating.
  };

  const toggleExplanation = (qId: string) => {
    setShowExplanation(prev => ({ ...prev, [qId]: !prev[qId] }));
  };

  return (
    <div className="space-y-12">
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
            <div className="flex justify-between items-start">
              <span className="px-3 py-1 bg-sky-500/20 text-sky-400 rounded-full text-xs font-bold uppercase tracking-wider">
                {q.type.replace('_', ' ')}
              </span>
              <span className="text-slate-500 text-sm font-medium">문제 {idx + 1}</span>
            </div>

            <h3 className={`font-bold leading-relaxed ${fontSizeClass} ${quizFontSize === 'large' ? 'mb-4' : ''}`}>
              {q.question}
            </h3>

            {isSecondChanceActive && (
              <div className="flex items-center gap-2 text-amber-400 text-sm font-bold bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                <AlertCircle size={16} />
                <span>오답입니다! 한 번 더 기회가 있습니다. 다시 풀어보세요.</span>
              </div>
            )}

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
                      disabled={answered || isOptionDisabled}
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

            {(q.type === 'SHORT_ANSWER' || q.type === 'CSAT') && (!q.options || q.options.length === 0) && (
              <div className="space-y-4">
                {answered ? (
                   <div className="p-4 rounded-xl border border-sky-500 bg-sky-500/10 text-slate-200">
                      <div className="flex items-center gap-2 mb-4 font-bold text-sky-400">
                         <CheckCircle2 size={18} />
                         제출 완료! 모범 답안과 비교해보세요.
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
                   </div>
                ) : (
                  <div className="flex gap-3">
                    <input 
                      type="text"
                      placeholder="자유롭게 답안을 서술하세요..."
                      value={shortAnswerInputs[q.id] || ''}
                      onChange={(e) => setShortAnswerInputs(prev => ({ ...prev, [q.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleShortAnswerSubmit(q.id);
                      }}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <button 
                      className="btn-premium px-6 py-2 rounded-xl text-sm font-bold whitespace-nowrap disabled:opacity-50"
                      onClick={() => handleShortAnswerSubmit(q.id)}
                      disabled={!shortAnswerInputs[q.id]?.trim()}
                    >
                      답안 제출
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="mt-auto pt-6 border-t border-slate-800 space-y-4">
              <div className="flex flex-wrap gap-4 items-center">
                <button 
                  onClick={() => onShowContext(q.sourceContext)}
                  className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors"
                >
                  <BookOpen size={16} />
                  <span>원문 근거 확인</span>
                </button>
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
    </div>
  );
}
