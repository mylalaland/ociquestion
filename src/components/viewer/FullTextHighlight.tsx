'use client';

import { motion } from 'framer-motion';
import { useRef, useEffect } from 'react';

interface FullTextHighlightProps {
  text: string;
  highlights: string[];
  activeHighlight?: string | null;
  images?: string[];
}

export default function FullTextHighlight({ text, highlights, activeHighlight, images }: FullTextHighlightProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (activeHighlight && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeHighlight]);

  const renderHighlightedText = () => {
    if (!activeHighlight) return text.split('\n').map((l, i) => <p key={i} className="mb-4">{l}</p>);

    // Normalize text for better matching (handle AI's slight variations in spaces/newlines)
    let matchIndex = text.indexOf(activeHighlight);
    let matchLength = activeHighlight.length;

    if (matchIndex === -1) {
      try {
         // Create a regex from activeHighlight by escaping regex chars and replacing spaces with \s+
         const escaped = activeHighlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
         const regexSource = escaped.split(/\s+/).join('\\s+');
         const regex = new RegExp(regexSource, 'i');
         const match = text.match(regex);
         if (match && match.index !== undefined) {
             matchIndex = match.index;
             matchLength = match[0].length;
         }
      } catch (e) {}
    }

    if (matchIndex === -1) {
      return text.split('\n').map((l, i) => <p key={i} className="mb-4">{l}</p>);
    }

    const before = text.substring(0, matchIndex);
    const match = text.substring(matchIndex, matchIndex + matchLength);
    const after = text.substring(matchIndex + matchLength);

    return (
      <div className="whitespace-pre-wrap">
        {before}
        <motion.span 
          ref={highlightRef}
          initial={{ backgroundColor: 'transparent', boxShadow: '0 0 0px skyblue' }}
          animate={{ backgroundColor: 'rgba(56, 189, 248, 0.4)', boxShadow: '0 0 20px rgba(56, 189, 248, 0.3)' }}
          className="highlight-sky px-1 rounded border-b-2 border-sky-400 font-bold text-white relative z-10"
        >
          {match}
        </motion.span>
        {after}
      </div>
    );
  };

  return (
    <div 
      ref={containerRef}
      className="glass p-10 rounded-3xl h-[700px] overflow-y-auto space-y-4 custom-scrollbar relative"
    >
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 flex items-center justify-between mb-8 shadow-sm">
        <h3 className="text-lg font-bold flex items-center gap-2 text-slate-200">
          <span className="p-2 bg-amber-500/20 rounded-lg text-amber-500 shadow-inner">📄</span>
          원문 분석 뷰어
        </h3>
        <span className="text-[10px] text-slate-500 tracking-widest uppercase font-bold bg-slate-950 px-3 py-1 rounded-full">Analysis Mode</span>
      </div>
      
      <div className="prose prose-invert max-w-none text-slate-300 leading-relaxed font-light text-sm">
        {images && images.length > 0 && (
          <div className="mb-8 space-y-4">
            {images.map((url, idx) => (
              <img key={idx} src={url} alt={`Uploaded Original ${idx}`} className="rounded-xl w-full object-contain max-h-[800px] border border-slate-800" />
            ))}
          </div>
        )}
        {text && text.trim() && renderHighlightedText()}
      </div>
    </div>
  );
}
