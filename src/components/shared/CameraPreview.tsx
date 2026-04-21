'use client';

import { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCcw, Check, X, Trash2, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CameraPreviewProps {
  onCapture: (files: File[]) => void;
  onClose: () => void;
}

export default function CameraPreview({ onCapture, onClose }: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedFiles, setCapturedFiles] = useState<{ id: string, file: File, preview: string }[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [showFlash, setShowFlash] = useState(false);

  useEffect(() => {
    let currentStream: MediaStream | null = null;
    async function setupCamera() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, 
          audio: false 
        });
        currentStream = s;
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
        setIsReady(true);
      } catch (err) {
        console.error("Camera access error:", err);
        alert("카메라에 접근할 수 없습니다. 권한을 확인해주세요.");
        onClose();
      }
    }
    setupCamera();

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => {
           track.stop();
        });
      }
      if (stream) {
        stream.getTracks().forEach(track => {
           track.stop();
        });
      }
    };
  }, []);

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    // Flash effect
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 100);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
          setCapturedFiles(prev => [...prev, { 
            id: Math.random().toString(36).substr(2, 9), 
            file, 
            preview: dataUrl 
          }]);
        }
      }, 'image/jpeg', 0.8);
    }
  };

  const removePhoto = (id: string) => {
    setCapturedFiles(prev => prev.filter(p => p.id !== id));
  };

  const handleFinish = () => {
    if (capturedFiles.length === 0) return;
    onCapture(capturedFiles.map(p => p.file));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center">
      {/* Video Preview Layer */}
      <div className="relative w-full h-full flex flex-col items-center">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          className="w-full h-full object-cover"
        />
        
        {/* Flash Overlay */}
        <AnimatePresence>
          {showFlash && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white z-10"
            />
          )}
        </AnimatePresence>

        {/* Top Controls */}
        <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent">
          <button 
            onClick={onClose}
            className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors"
          >
            <X size={24} />
          </button>
          <div className="flex items-center gap-2 px-4 py-2 bg-sky-500 rounded-full text-white font-bold text-sm shadow-lg">
            <Layers size={18} />
            {capturedFiles.length}장 촬영됨
          </div>
        </div>

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-8 flex flex-col items-center gap-6 bg-gradient-to-t from-black/80 to-transparent">
          {/* Thumbnails Row */}
          <div className="flex gap-3 overflow-x-auto w-full max-w-md pb-2 custom-scrollbar justify-center">
            {capturedFiles.map((p) => (
              <motion.div 
                key={p.id}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="relative flex-shrink-0 w-16 h-20 rounded-lg overflow-hidden border-2 border-sky-500/50"
              >
                <img src={p.preview} className="w-full h-full object-cover" alt="Captured Thumbnail" />
                <button 
                  onClick={() => removePhoto(p.id)}
                  className="absolute top-0 right-0 p-1 bg-red-500 text-white rounded-bl-lg"
                >
                  <Trash2 size={12} />
                </button>
              </motion.div>
            ))}
          </div>

          <div className="flex justify-between items-center w-full max-w-sm gap-8 px-4">
            <div className="w-16" /> {/* Placeholder for balance */}
            
            <button 
              onClick={takePhoto}
              className="p-8 bg-white rounded-full text-slate-900 shadow-2xl hover:scale-105 active:scale-95 transition-all border-4 border-slate-300"
            >
              <Camera size={40} />
            </button>

            <button 
              onClick={handleFinish}
              disabled={capturedFiles.length === 0}
              className={`flex flex-col items-center gap-1 transition-all ${capturedFiles.length > 0 ? 'text-sky-400 opacity-100' : 'text-slate-600 opacity-50'}`}
            >
              <div className="p-4 bg-sky-500/20 rounded-2xl border border-sky-500/30">
                <Check size={28} />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider">완료</span>
            </button>
          </div>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
