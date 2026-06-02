'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

interface BonusRouletteProps {
  minPoints: number;
  maxPoints: number;
  onComplete: (points: number) => void;
}

const ROULETTE_COLORS = [
  '#38bdf8', '#818cf8', '#fbbf24', '#34d399', '#f472b6',
  '#fb923c', '#a78bfa', '#22d3ee', '#84cc16', '#f87171',
];

export default function BonusRoulette({ minPoints, maxPoints, onComplete }: BonusRouletteProps) {
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [rotation, setRotation] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const segments = 8;
  const segmentAngle = 360 / segments;
  
  // Generate segment values
  const segmentValues = Array.from({ length: segments }, (_, i) => {
    const range = maxPoints - minPoints;
    return Math.round(minPoints + (range * i) / (segments - 1));
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const size = canvas.width;
    const center = size / 2;
    const radius = center - 10;
    
    ctx.clearRect(0, 0, size, size);
    
    // Draw segments
    for (let i = 0; i < segments; i++) {
      const startAngle = (i * segmentAngle - 90) * Math.PI / 180;
      const endAngle = ((i + 1) * segmentAngle - 90) * Math.PI / 180;
      
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = ROULETTE_COLORS[i % ROULETTE_COLORS.length];
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Draw text
      const textAngle = ((i + 0.5) * segmentAngle - 90) * Math.PI / 180;
      const textX = center + Math.cos(textAngle) * (radius * 0.65);
      const textY = center + Math.sin(textAngle) * (radius * 0.65);
      
      ctx.save();
      ctx.translate(textX, textY);
      ctx.rotate(textAngle + Math.PI / 2);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`+${segmentValues[i]}P`, 0, 0);
      ctx.restore();
    }
    
    // Center circle
    ctx.beginPath();
    ctx.arc(center, center, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3;
    ctx.stroke();
  }, [segmentValues]);

  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    setResult(null);
    
    const winIndex = Math.floor(Math.random() * segments);
    const winValue = segmentValues[winIndex];
    
    // Calculate final rotation to land on the winning segment
    const extraSpins = 5 + Math.floor(Math.random() * 3);
    const targetAngle = 360 - (winIndex * segmentAngle + segmentAngle / 2);
    const finalRotation = rotation + extraSpins * 360 + targetAngle;
    
    setRotation(finalRotation);
    
    setTimeout(() => {
      setSpinning(false);
      setResult(winValue);
      setTimeout(() => onComplete(winValue), 1500);
    }, 4000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4"
    >
      <div className="bg-slate-900/95 backdrop-blur-2xl rounded-[32px] border border-slate-700 p-8 max-w-sm w-full text-center space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">
            🎰 보너스 룰렛!
          </h2>
          <p className="text-slate-400 text-sm">
            전부 맞혔어요! 특별 보너스를 뽑아보세요!
          </p>
        </div>
        
        {/* Roulette wheel */}
        <div className="relative mx-auto w-64 h-64">
          {/* Pointer */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10 text-3xl">
            ▼
          </div>
          
          <motion.div
            animate={{ rotate: rotation }}
            transition={{ duration: 4, ease: [0.17, 0.67, 0.12, 0.99] }}
            className="w-full h-full"
          >
            <canvas
              ref={canvasRef}
              width={256}
              height={256}
              className="w-full h-full"
            />
          </motion.div>
        </div>
        
        {result !== null ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="space-y-3"
          >
            <div className="text-5xl font-black text-yellow-400">+{result}P</div>
            <p className="text-emerald-400 font-bold">🎉 보너스 포인트 획득!</p>
          </motion.div>
        ) : (
          <button
            onClick={spin}
            disabled={spinning}
            className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-black text-lg rounded-2xl hover:scale-105 transition-transform disabled:opacity-50 shadow-lg shadow-orange-500/30"
          >
            {spinning ? '🎰 돌아가는 중...' : '🎰 룰렛 돌리기!'}
          </button>
        )}
      </div>
    </motion.div>
  );
}
