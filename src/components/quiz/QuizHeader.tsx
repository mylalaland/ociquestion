'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Download, FileText, BrainCircuit, Home as HomeIcon } from 'lucide-react';

interface QuizHeaderProps {
  title: string;
  summary: string;
  subject: string;
  totalPoints: number;
  onGoHome: () => void;
  onExportPdf: () => void;
  onExportTxt: () => void;
  onPointClick: () => void;
}

export default function QuizHeader({
  title,
  summary,
  subject,
  totalPoints,
  onGoHome,
  onExportPdf,
  onExportTxt,
  onPointClick,
}: QuizHeaderProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/50">
      {/* Compact Nav Bar - always visible */}
      <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={onGoHome} 
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors p-2 rounded-xl hover:bg-white/5"
          >
            <HomeIcon size={20} />
            <span className="hidden md:inline text-sm font-bold">첫 화면</span>
          </button>
          <div className="h-5 w-px bg-slate-800" />
          <div className="flex items-center gap-2">
            <BrainCircuit size={16} className="text-sky-400" />
            <span className="text-sm font-bold shimmer-text">Lala Quiz</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="glass px-3 py-1.5 rounded-xl flex items-center gap-2 hover:bg-white/10 transition-all text-sm text-slate-300"
          >
            <FileText size={14} className="text-sky-400" />
            <span className="hidden sm:inline text-xs">정보</span>
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            onClick={onPointClick}
            className="glass px-3 py-1.5 rounded-xl flex items-center gap-2 hover:bg-white/10 active:scale-95 transition-all text-left focus:outline-none"
          >
            <span className="text-lg">🏆</span>
            <span className="text-sky-400 font-bold text-sm">{totalPoints} P</span>
          </button>
        </div>
      </div>

      {/* Expandable Details - collapsed by default */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden border-t border-slate-800/50"
          >
            <div className="max-w-[1600px] mx-auto px-4 py-4 space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-1 bg-slate-800 rounded-md text-xs font-bold text-sky-400">{subject}</span>
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-sky-500 dark:text-sky-400 drop-shadow-sm leading-tight">
                  {title}
                </h2>
                <p className="text-slate-400 mt-1 text-sm">{summary}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={onExportPdf}
                  className="btn-premium px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"
                >
                  <Download size={14} /> PDF
                </button>
                <button
                  onClick={onExportTxt}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
                >
                  <Download size={14} /> TXT
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
