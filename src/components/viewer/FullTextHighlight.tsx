'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';
import { X, Image as ImageIcon } from 'lucide-react';

interface FullTextHighlightProps {
  text: string;
  highlights: string[];
  activeHighlight?: string | null;
  images?: string[];
}

export default function FullTextHighlight({ text, highlights, activeHighlight, images }: FullTextHighlightProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLSpanElement>(null);
  const [showImageModal, setShowImageModal] = useState(false);

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
    <>
      <div 
        ref={containerRef}
        className="glass p-10 rounded-3xl overflow-y-auto space-y-4 custom-scrollbar relative"
        style={{ maxHeight: 'calc(100vh - 200px)' }}
      >
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 flex items-center justify-between mb-8 shadow-sm">
        <h3 className="text-lg font-bold flex items-center gap-2 text-slate-200">
          <span className="p-2 bg-amber-500/20 rounded-lg text-amber-500 shadow-inner">📄</span>
          원문 분석 뷰어
        </h3>
        <span className="text-[10px] text-slate-500 tracking-widest uppercase font-bold bg-slate-950 px-3 py-1 rounded-full">Analysis Mode</span>
      </div>
      
      {images && images.length > 0 && (
        <button 
          onClick={() => setShowImageModal(true)}
          className="w-full flex items-center justify-center gap-2 py-4 bg-slate-800/80 hover:bg-slate-700 border border-slate-600 rounded-2xl mb-8 text-sky-400 font-bold transition-all"
        >
          <ImageIcon size={20} />
          첨부된 원본 이미지 보기 ({images.length}장)
        </button>
      )}

      <div className="prose prose-invert max-w-none text-slate-300 leading-relaxed font-light text-sm">
        {text && text.trim() && renderHighlightedText()}
      </div>
    </div>

    <AnimatePresence>
      {showImageModal && images && images.length > 0 && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4"
        >
           <div className="absolute top-8 right-8">
             <button onClick={() => setShowImageModal(false)} className="p-3 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors">
                <X size={32} />
             </button>
           </div>
           <div className="flex gap-4 overflow-x-auto p-4 w-full h-full items-center custom-scrollbar">
              {images.map((url, idx) => (
                <img key={idx} src={url} alt={`Uploaded Original ${idx}`} className="flex-shrink-0 h-[80vh] w-auto max-w-full object-contain rounded-2xl border border-slate-700 shadow-2xl" />
              ))}
           </div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
