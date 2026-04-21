'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Home, Share2, RotateCcw, Copy, Image as ImageIcon, FileText, Download, Check, Trophy, Star, TrendingUp } from 'lucide-react';
import { QuizQuestion, PointConfig, DEFAULT_POINT_CONFIG } from '@/lib/ai/types';

interface QuizResultScreenProps {
  questions: QuizQuestion[];
  correctMap: Record<string, boolean>;
  halfPointMap: Record<string, boolean>; // questions answered correctly on 2nd attempt
  score: number;
  totalQuestions: number;
  passThreshold: number; // percent
  pointConfig: PointConfig;
  totalPointsBefore: number; // points before this quiz
  earnedPoints: number;
  subject: string;
  difficulty: string;
  onGoHome: () => void;
  onRetry: () => void;
}

// Pure CSS confetti
function Confetti() {
  const colors = ['#38bdf8', '#818cf8', '#fcd34d', '#34d399', '#f472b6', '#fb923c'];
  const pieces = useMemo(() => Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    color: colors[i % colors.length],
    delay: `${Math.random() * 3}s`,
    duration: `${2 + Math.random() * 3}s`,
    swayDuration: `${1 + Math.random() * 2}s`,
    size: `${6 + Math.random() * 8}px`,
    shape: Math.random() > 0.5 ? '50%' : '2px',
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })), []);

  return (
    <div className="confetti-container">
      {pieces.map(p => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: p.left,
            backgroundColor: p.color,
            width: p.size,
            height: p.size,
            borderRadius: p.shape,
            animationDelay: p.delay,
            animationDuration: `${p.duration}, ${p.swayDuration}`,
          }}
        />
      ))}
    </div>
  );
}

// SVG circular progress
function ScoreCircle({ percent, color }: { percent: number; color: string }) {
  const circumference = 2 * Math.PI * 50;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative w-48 h-48">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
        <circle
          cx="60" cy="60" r="50" fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="score-circle"
          style={{ filter: `drop-shadow(0 0 8px ${color}40)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-black count-up" style={{ color }}>{Math.round(percent)}%</span>
        <span className="text-slate-400 text-sm mt-1">정답률</span>
      </div>
    </div>
  );
}

export default function QuizResultScreen({
  questions,
  correctMap,
  halfPointMap,
  score,
  totalQuestions,
  passThreshold,
  pointConfig,
  totalPointsBefore,
  earnedPoints,
  subject,
  difficulty,
  onGoHome,
  onRetry,
}: QuizResultScreenProps) {
  const percent = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
  const passed = percent >= passThreshold;
  const resultRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [animatedPoints, setAnimatedPoints] = useState(0);

  // Animated points counter
  useEffect(() => {
    if (earnedPoints <= 0) return;
    let current = 0;
    const step = Math.max(1, Math.floor(earnedPoints / 30));
    const timer = setInterval(() => {
      current += step;
      if (current >= earnedPoints) {
        current = earnedPoints;
        clearInterval(timer);
      }
      setAnimatedPoints(current);
    }, 40);
    return () => clearInterval(timer);
  }, [earnedPoints]);

  // Build type stats
  const typeStats = useMemo(() => {
    const stats: Record<string, { total: number; correct: number; points: number }> = {};
    const typeLabels: Record<string, string> = {
      MULTIPLE_CHOICE: '객관식',
      SHORT_ANSWER: '단답형',
      ESSAY: '서술형',
      CSAT: '수능형',
    };
    questions.forEach(q => {
      if (!stats[q.type]) stats[q.type] = { total: 0, correct: 0, points: 0 };
      stats[q.type].total++;
      if (correctMap[q.id]) {
        stats[q.type].correct++;
        const base = pointConfig[q.type as keyof PointConfig] || 10;
        stats[q.type].points += halfPointMap[q.id] ? Math.floor(base * 0.5) : base;
      }
    });
    return Object.entries(stats).map(([type, data]) => ({
      type,
      label: typeLabels[type] || type,
      ...data,
    }));
  }, [questions, correctMap, halfPointMap, pointConfig]);

  const buildShareText = () => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
    let text = `🎯 [oci 질문] 성적표 🎯\n`;
    text += `━━━━━━━━━━━━━━━━━━\n`;
    text += `📚 과목: ${subject || '미지정'}\n`;
    text += `📅 날짜: ${dateStr}\n`;
    text += `🎯 난이도: ${difficulty}\n`;
    text += `━━━━━━━━━━━━━━━━━━\n`;
    text += `✅ 정답: ${score}/${totalQuestions} 문제\n`;
    text += `📊 정답률: ${percent}%\n`;
    text += `🏆 획득 포인트: +${earnedPoints}P\n`;
    text += `━━━━━━━━━━━━━━━━━━\n`;
    text += `[문항별 상세]\n`;
    questions.forEach((q, i) => {
      const mark = correctMap[q.id] ? '✅' : '❌';
      const half = halfPointMap[q.id] ? '(2차)' : '';
      text += `Q${i + 1}. ${q.type === 'MULTIPLE_CHOICE' ? '객관식' : q.type === 'SHORT_ANSWER' ? '단답형' : q.type === 'ESSAY' ? '서술형' : '수능형'} ${mark}${half} `;
    });
    text += `\n━━━━━━━━━━━━━━━━━━\n`;
    text += `누적 포인트: ${totalPointsBefore + earnedPoints}P\n`;
    text += `${passed ? '🎉 합격!' : '💪 다음엔 더 잘할 수 있어요!'}\n`;
    return text;
  };

  const handleSystemShare = async () => {
    const text = buildShareText();
    if (navigator.share) {
      try {
        await navigator.share({ title: '내 퀴즈 성적표 - oci 질문', text });
      } catch { /* cancelled */ }
    } else {
      await handleCopyText();
    }
  };

  const handleCopyText = async () => {
    const text = buildShareText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleImageShare = async () => {
    try {
      const htmlToImage = await import('html-to-image');
      if (!resultRef.current) return;
      const dataUrl = await htmlToImage.toPng(resultRef.current, {
        backgroundColor: '#0f172a',
        pixelRatio: 2,
      });
      // Try to share the image
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'quiz-result.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: '퀴즈 성적표' });
      } else {
        // Download image fallback
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = 'quiz-result.png';
        link.click();
      }
    } catch (e: any) {
      alert('이미지 캡처 중 오류: ' + (e.message || '알 수 없는 오류'));
    }
  };

  const handlePdfExport = async () => {
    try {
      const htmlToImage = await import('html-to-image');
      const { default: jsPDF } = await import('jspdf');
      if (!resultRef.current) return;
      const imgData = await htmlToImage.toPng(resultRef.current, {
        backgroundColor: '#0f172a',
        pixelRatio: 2,
      });
      const doc = new jsPDF('p', 'mm', 'a4');
      const imgProps = doc.getImageProperties(imgData);
      const pdfWidth = doc.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      doc.save(`성적표_${subject || 'quiz'}.pdf`);
    } catch (e: any) {
      alert('PDF 저장 중 오류: ' + (e.message || '알 수 없는 오류'));
    }
  };

  const gradeEmoji = percent >= 90 ? '🏅' : percent >= 70 ? '🎉' : percent >= 50 ? '💪' : '📚';
  const gradeMessage = percent >= 90 ? '완벽에 가까워요! 최고!' : percent >= 70 ? '잘했어요! 훌륭합니다!' : percent >= 50 ? '좋은 시작이에요! 조금만 더!' : '다시 도전해봐요! 화이팅!';
  const circleColor = passed ? '#34d399' : percent >= 50 ? '#fbbf24' : '#f87171';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto"
    >
      {passed && <Confetti />}

      <motion.div
        ref={resultRef}
        initial={{ scale: 0.8, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 100 }}
        className="w-full max-w-lg bg-slate-900/90 backdrop-blur-2xl rounded-[32px] border border-slate-700/50 shadow-2xl overflow-hidden"
      >
        {/* Top gradient bar */}
        <div className={`h-2 w-full ${passed ? 'bg-gradient-to-r from-emerald-400 to-sky-400' : 'bg-gradient-to-r from-amber-400 to-orange-400'}`} />

        <div className="p-8 space-y-8">
          {/* Header */}
          <div className="text-center space-y-2">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: 'spring' }}
              className="text-6xl"
            >
              {gradeEmoji}
            </motion.div>
            <h2 className="text-2xl font-black text-white">{passed ? '축하합니다!' : '수고하셨습니다!'}</h2>
            <p className="text-slate-400">{gradeMessage}</p>
            <div className="flex items-center justify-center gap-2 flex-wrap mt-2">
              <span className="px-3 py-1 bg-slate-800 rounded-full text-xs font-bold text-sky-400">{subject || '과목 미지정'}</span>
              <span className="px-3 py-1 bg-slate-800 rounded-full text-xs font-bold text-amber-400">난이도: {difficulty}</span>
            </div>
          </div>

          {/* Score Circle */}
          <div className="flex justify-center">
            <ScoreCircle percent={percent} color={circleColor} />
          </div>

          {/* Score Summary */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
              <div className="text-2xl font-black text-white">{score}</div>
              <div className="text-xs text-slate-400 mt-1">정답</div>
            </div>
            <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
              <div className="text-2xl font-black text-white">{totalQuestions - score}</div>
              <div className="text-xs text-slate-400 mt-1">오답</div>
            </div>
            <div className={`rounded-2xl p-4 border ${earnedPoints > 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-800/50 border-slate-700/50'}`}>
              <div className={`text-2xl font-black ${earnedPoints > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                +{animatedPoints}<span className="text-sm">P</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">포인트</div>
            </div>
          </div>

          {/* Type Stats */}
          {typeStats.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-400 flex items-center gap-2">
                <TrendingUp size={14} /> 유형별 성과
              </h3>
              <div className="space-y-2">
                {typeStats.map(ts => (
                  <div key={ts.type} className="flex items-center justify-between bg-slate-800/30 rounded-xl px-4 py-3 border border-slate-700/30">
                    <span className="text-sm text-slate-300">{ts.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-white">{ts.correct}/{ts.total}</span>
                      <span className="text-xs text-emerald-400 font-bold">+{ts.points}P</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cumulative points */}
          <div className="flex items-center justify-center gap-2 bg-sky-500/10 border border-sky-500/20 rounded-2xl py-3 px-4">
            <Trophy size={18} className="text-sky-400" />
            <span className="text-sm text-slate-300">누적 포인트:</span>
            <span className="text-lg font-black text-sky-400">{totalPointsBefore + earnedPoints} P</span>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 pt-0 space-y-3">
          {/* Share button */}
          <div className="relative">
            <button
              onClick={() => setShowShareMenu(!showShareMenu)}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-sky-500 to-indigo-500 text-white px-6 py-4 rounded-2xl font-bold shadow-lg hover:shadow-sky-500/30 transition-all hover:scale-[1.02]"
            >
              <Share2 size={20} /> 부모님께 결과 보내기
            </button>
            {showShareMenu && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-full mb-2 left-0 right-0 bg-slate-800 border border-slate-700 rounded-2xl p-3 shadow-2xl space-y-2 z-10"
              >
                <button onClick={() => { handleSystemShare(); setShowShareMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-left">
                  <Share2 size={18} className="text-sky-400 shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-white">카카오톡 / 문자 등으로 공유</div>
                    <div className="text-xs text-slate-500">시스템 공유 메뉴가 열립니다</div>
                  </div>
                </button>
                <button onClick={() => { handleCopyText(); setShowShareMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-left">
                  {copied ? <Check size={18} className="text-emerald-400 shrink-0" /> : <Copy size={18} className="text-amber-400 shrink-0" />}
                  <div>
                    <div className="text-sm font-bold text-white">{copied ? '복사 완료!' : '텍스트 복사'}</div>
                    <div className="text-xs text-slate-500">성적표를 클립보드에 복사합니다</div>
                  </div>
                </button>
                <button onClick={() => { handleImageShare(); setShowShareMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-left">
                  <ImageIcon size={18} className="text-emerald-400 shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-white">이미지로 저장</div>
                    <div className="text-xs text-slate-500">성적표를 예쁜 이미지로 캡처합니다</div>
                  </div>
                </button>
                <button onClick={() => { handlePdfExport(); setShowShareMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-left">
                  <FileText size={18} className="text-rose-400 shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-white">PDF로 저장</div>
                    <div className="text-xs text-slate-500">문서 파일로 다운로드합니다</div>
                  </div>
                </button>
              </motion.div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onGoHome}
              className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-3 rounded-2xl font-bold transition-colors text-sm"
            >
              <Home size={18} /> 첫 화면으로
            </button>
            <button
              onClick={onRetry}
              className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-3 rounded-2xl font-bold transition-colors text-sm"
            >
              <RotateCcw size={18} /> 다시 만들기
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
