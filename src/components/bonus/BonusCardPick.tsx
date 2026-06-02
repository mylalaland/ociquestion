'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BonusCardPickProps {
  minPoints: number;
  maxPoints: number;
  onComplete: (points: number) => void;
}

const CARD_BACKS = ['🌟', '⭐', '💫'];
const CARD_COLORS = [
  'from-sky-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
];

export default function BonusCardPick({ minPoints, maxPoints, onComplete }: BonusCardPickProps) {
  const [cards] = useState(() => {
    return Array.from({ length: 3 }, () => {
      return Math.floor(Math.random() * (maxPoints - minPoints + 1)) + minPoints;
    });
  });
  const [flipped, setFlipped] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  const handlePick = (index: number) => {
    if (flipped !== null) return;
    setFlipped(index);
    setRevealed(true);
    setTimeout(() => onComplete(cards[index]), 2500);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4"
    >
      <div className="bg-slate-900/95 backdrop-blur-2xl rounded-[32px] border border-slate-700 p-8 max-w-md w-full text-center space-y-8">
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-pink-400">
            🃏 보너스 카드!
          </h2>
          <p className="text-slate-400 text-sm">
            {revealed ? '카드를 뽑았습니다!' : '3장 중 1장을 골라보세요!'}
          </p>
        </div>
        
        <div className="flex justify-center gap-4">
          {cards.map((value, idx) => (
            <motion.button
              key={idx}
              onClick={() => handlePick(idx)}
              disabled={flipped !== null}
              whileHover={flipped === null ? { scale: 1.08, y: -8 } : {}}
              whileTap={flipped === null ? { scale: 0.95 } : {}}
              className={`relative w-24 h-36 rounded-2xl cursor-pointer transition-all ${
                flipped !== null && flipped !== idx ? 'opacity-40 scale-90' : ''
              }`}
              style={{ perspective: '800px' }}
            >
              <AnimatePresence mode="wait">
                {flipped === idx ? (
                  <motion.div
                    key="front"
                    initial={{ rotateY: 180, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className={`absolute inset-0 bg-gradient-to-br ${CARD_COLORS[idx]} rounded-2xl flex flex-col items-center justify-center shadow-2xl border-2 border-white/20`}
                  >
                    <span className="text-3xl font-black text-white">+{value}</span>
                    <span className="text-sm font-bold text-white/80 mt-1">P</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="back"
                    exit={{ rotateY: -180, opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className={`absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-800 rounded-2xl flex items-center justify-center shadow-xl border-2 border-slate-600 hover:border-sky-500/50`}
                  >
                    <span className="text-4xl">{CARD_BACKS[idx]}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          ))}
        </div>

        {revealed && flipped !== null && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.8, type: 'spring' }}
            className="space-y-2"
          >
            <div className="text-4xl font-black text-yellow-400">+{cards[flipped]}P</div>
            <p className="text-emerald-400 font-bold text-sm">🎉 보너스 포인트 획득!</p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
